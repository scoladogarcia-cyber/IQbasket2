#!/usr/bin/env python3
"""Controlled optimizer for Base64 player photos stored in PostgreSQL.

The script never changes schema or non-photo fields. It supports export,
apply, verify and restore so the workflow can fail closed.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import io
import json
import os
from pathlib import Path

import psycopg
from PIL import Image, ImageOps

ROOT = Path(os.environ.get("PHOTO_WORKDIR", "photo-migration"))
ORIGINALS = ROOT / "originals"
OPTIMIZED = ROOT / "optimized"
ROWS_FILE = ROOT / "original-photo-rows.json.gz"
MANIFEST_FILE = ROOT / "manifest.json"
MAX_EDGE = int(os.environ.get("PHOTO_MAX_EDGE", "640"))
QUALITY = int(os.environ.get("PHOTO_WEBP_QUALITY", "84"))


def dsn() -> str:
    value = os.environ.get("SUPABASE_DB_URL", "")
    if not value:
        raise RuntimeError("SUPABASE_DB_URL is required")
    return value


def parse_data_uri(value: str) -> tuple[str, bytes]:
    header, payload = value.split(",", 1)
    if not header.startswith("data:image/") or ";base64" not in header:
        raise ValueError("Unsupported photo data URI")
    mime = header[5:].split(";", 1)[0]
    return mime, base64.b64decode(payload, validate=True)


def optimized_uri(raw: bytes) -> tuple[str, bytes, tuple[int, int], tuple[int, int]]:
    with Image.open(io.BytesIO(raw)) as source:
        source.load()
        image = ImageOps.exif_transpose(source)
        before = image.size
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        after = image.size
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=QUALITY, method=6)
    data = output.getvalue()
    uri = "data:image/webp;base64," + base64.b64encode(data).decode("ascii")
    return uri, data, before, after


def export() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    ORIGINALS.mkdir(exist_ok=True)
    OPTIMIZED.mkdir(exist_ok=True)
    with psycopg.connect(dsn()) as conn:
        rows = conn.execute(
            """select id::text, photo_url, md5(photo_url)
               from public.players
               where photo_url like 'data:image/%;base64,%'
               order by id"""
        ).fetchall()
    if not rows:
        raise RuntimeError("No Base64 player photos found")

    backup_rows = []
    manifest = []
    for player_id, photo_url, source_md5 in rows:
        mime, raw = parse_data_uri(photo_url)
        uri, webp, before_dim, after_dim = optimized_uri(raw)
        original_sha = hashlib.sha256(raw).hexdigest()
        optimized_sha = hashlib.sha256(webp).hexdigest()
        (ORIGINALS / f"{player_id}.bin").write_bytes(raw)
        (OPTIMIZED / f"{player_id}.webp").write_bytes(webp)
        backup_rows.append(
            {"id": player_id, "photo_url": photo_url, "source_md5": source_md5}
        )
        manifest.append(
            {
                "id": player_id,
                "mime": mime,
                "original_bytes": len(raw),
                "optimized_bytes": len(webp),
                "original_sha256": original_sha,
                "optimized_sha256": optimized_sha,
                "before_dimensions": list(before_dim),
                "after_dimensions": list(after_dim),
                "optimized_uri_chars": len(uri),
            }
        )

    with gzip.open(ROWS_FILE, "wt", encoding="utf-8") as fh:
        json.dump(backup_rows, fh, ensure_ascii=False)
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    original_chars = sum(len(row[1]) for row in rows)
    optimized_bytes = sum(item["optimized_bytes"] for item in manifest)
    print(f"PHOTO_EXPORT count={len(rows)} original_uri_chars={original_chars} optimized_binary_bytes={optimized_bytes}")


def load_backup_rows() -> list[dict]:
    with gzip.open(ROWS_FILE, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def apply() -> None:
    rows = load_backup_rows()
    with psycopg.connect(dsn()) as conn:
        with conn.transaction():
            for row in rows:
                raw = (OPTIMIZED / f"{row['id']}.webp").read_bytes()
                photo_uri = "data:image/webp;base64," + base64.b64encode(raw).decode("ascii")
                cur = conn.execute(
                    """update public.players
                       set photo_url = %s
                       where id = %s::uuid and md5(photo_url) = %s""",
                    (photo_uri, row["id"], row["source_md5"]),
                )
                if cur.rowcount != 1:
                    raise RuntimeError(f"Concurrent photo change detected for {row['id']}")
    print(f"PHOTO_APPLY updated={len(rows)}")


def restore() -> None:
    rows = load_backup_rows()
    with psycopg.connect(dsn()) as conn:
        with conn.transaction():
            for row in rows:
                conn.execute(
                    "update public.players set photo_url = %s where id = %s::uuid",
                    (row["photo_url"], row["id"]),
                )
    print(f"PHOTO_RESTORE restored={len(rows)}")


def verify() -> None:
    rows = load_backup_rows()
    ids = [row["id"] for row in rows]
    with psycopg.connect(dsn()) as conn:
        current = conn.execute(
            """select id::text, photo_url
               from public.players
               where id = any(%s::uuid[])
               order by id""",
            (ids,),
        ).fetchall()
    if len(current) != len(rows):
        raise RuntimeError("Photo row count changed")
    total_chars = 0
    for player_id, photo_url in current:
        if not photo_url.startswith("data:image/webp;base64,"):
            raise RuntimeError(f"Unexpected photo format for {player_id}")
        _, raw = parse_data_uri(photo_url)
        with Image.open(io.BytesIO(raw)) as image:
            image.verify()
        total_chars += len(photo_url)
    original_chars = sum(len(row["photo_url"]) for row in rows)
    if total_chars >= original_chars * 0.25:
        raise RuntimeError("Photo reduction target not reached")
    print(f"PHOTO_VERIFY count={len(rows)} before_chars={original_chars} after_chars={total_chars}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["export", "apply", "verify", "restore"])
    args = parser.parse_args()
    globals()[args.command]()


if __name__ == "__main__":
    main()
