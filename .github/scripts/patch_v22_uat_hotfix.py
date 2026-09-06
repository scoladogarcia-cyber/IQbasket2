from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one match in {path}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_count(path, old, new, expected):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if text.count(old) != expected:
        raise SystemExit(f"Expected {expected} matches in {path}, found {text.count(old)}")
    file.write_text(text.replace(old, new), encoding="utf-8")


service = "services/ApprovalCenterService.js"
replace_once(
    service,
    '''function toTimestamp(value) {\n  const timestamp = value ? new Date(value).getTime() : 0;\n  return Number.isFinite(timestamp) ? timestamp : 0;\n}\n''',
    '''function toTimestamp(value) {\n  const timestamp = value ? new Date(value).getTime() : 0;\n  return Number.isFinite(timestamp) ? timestamp : 0;\n}\n\nfunction isPlayerSubmissionRequest(item = {}) {\n  return item?.type === RequestType.PLAYER_DATA_SUBMISSION\n    || Boolean(item?.raw?.submission_type);\n}\n'''
)
replace_count(
    service,
    'if (item.type === RequestType.PLAYER_DATA_SUBMISSION) {',
    'if (isPlayerSubmissionRequest(item)) {',
    2
)
replace_once(
    service,
    'if (!item?.id || item.type !== RequestType.PLAYER_DATA_SUBMISSION || !item.canReturn) {',
    'if (!item?.id || !isPlayerSubmissionRequest(item) || !item.canReturn) {'
)

view = "views/Player360View.js"
replace_once(
    view,
    '''  _renderTabs() {\n    const tabs = [];''',
    '''  _returnedSubmissionCount() {\n    return (this.submissionPanel?.items || []).filter(item =>\n      String(item?.status || "").toUpperCase() === "RETURNED"\n    ).length;\n  }\n\n  _renderSubmissionAttention() {\n    if (!this._usesSubmissionWorkflow()) return "";\n    const count = this._returnedSubmissionCount();\n    if (!count) return "";\n    const noun = count === 1 ? "aportación devuelta" : "aportaciones devueltas";\n    return `\n      <aside class="p360c-note" style="border:1px solid #fdba74;background:#fff7ed;color:#9a3412;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">\n        <div><strong>↩ Tienes ${count} ${noun}.</strong><br><span>Revisa el comentario del staff, corrige los datos y vuelve a enviarlos.</span></div>\n        <button type="button" id="p360c-open-returned-submissions" style="min-height:44px;border:1px solid #c2410c;border-radius:9px;background:#fff;color:#9a3412;font-weight:900;padding:9px 13px;cursor:pointer;">Revisar y corregir</button>\n      </aside>`;\n  }\n\n  _renderTabs() {\n    const tabs = [];'''
)
replace_once(
    view,
    '''    if (this._usesSubmissionWorkflow()) {\n      tabs.push({\n        id: "submissions",\n        label: this._isFamilyGuardian() ? "📨 Aportaciones de familia" : "📨 Mis aportaciones"\n      });\n    }''',
    '''    if (this._usesSubmissionWorkflow()) {\n      const returnedCount = this._returnedSubmissionCount();\n      const correctionLabel = returnedCount ? ` · ${returnedCount} por corregir` : "";\n      tabs.push({\n        id: "submissions",\n        label: `${this._isFamilyGuardian() ? "📨 Aportaciones de familia" : "📨 Mis aportaciones"}${correctionLabel}`\n      });\n    }'''
)
replace_once(
    view,
    '''        ${this._renderTabs()}\n        ${this._renderBody()}''',
    '''        ${this._renderSubmissionAttention()}\n        ${this._renderTabs()}\n        ${this._renderBody()}'''
)
replace_once(
    view,
    '''    this._bindTabs(container);\n    this._bindEvaluationEvents(container);''',
    '''    this._bindTabs(container);\n    container.querySelector("#p360c-open-returned-submissions")?.addEventListener("click", () => {\n      this.activeTab = "submissions";\n      this._renderLoaded(container);\n    });\n    this._bindEvaluationEvents(container);'''
)

print("V22_UAT_FRONTEND_PATCH_OK")
