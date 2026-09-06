from pathlib import Path

path = Path("services/DataStore.js")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { resolveHeadCoachName } from "../domain/staff/resolveHeadCoach.js";\n'
import_line = '''import {
  buildFamilyIdentityPolicy,
  applyFamilyIdentityPolicy,
  applyFamilyIdentityPolicyList
} from "./family/FamilyIdentityPolicy.js";\n'''
if import_line not in text:
    if text.count(import_anchor) != 1:
        raise SystemExit(f"DataStore import anchor expected once, found {text.count(import_anchor)}")
    text = text.replace(import_anchor, import_anchor + import_line, 1)

start_marker = "  _familyIdentityPolicy() {\n"
end_marker = "  getPlayerDirectory() {\n"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("Family identity method region not found exactly")
if text.find(start_marker, start + 1) >= 0:
    raise SystemExit("Duplicate _familyIdentityPolicy method found")

replacement = '''  _familyIdentityPolicy() {
    return buildFamilyIdentityPolicy(
      this.permissionService?.getCurrentUser?.() || null
    );
  }

  _applyFamilyIdentityPolicy(player) {
    return applyFamilyIdentityPolicy(player, this._familyIdentityPolicy());
  }

  _applyFamilyIdentityPolicyList(players = []) {
    return applyFamilyIdentityPolicyList(players, this._familyIdentityPolicy());
  }

'''
text = text[:start] + replacement + text[end:]
path.write_text(text, encoding="utf-8")

# Fail closed if the extracted policy was not actually wired into DataStore.
updated = path.read_text(encoding="utf-8")
required = [
    'from "./family/FamilyIdentityPolicy.js"',
    "return buildFamilyIdentityPolicy(",
    "return applyFamilyIdentityPolicy(player, this._familyIdentityPolicy())",
    "return applyFamilyIdentityPolicyList(players, this._familyIdentityPolicy())"
]
for token in required:
    if token not in updated:
        raise SystemExit(f"Missing expected DataStore integration token: {token}")

print("V26_FAMILY_IDENTITY_REFACTOR_OK")
