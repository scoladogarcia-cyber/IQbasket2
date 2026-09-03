import assert from "node:assert/strict";

import {
  PLAYER360_PRIVACY_ACTION,
  PLAYER360_PRIVACY_PURPOSE,
  PLAYER360_SUBJECT_RELATION
} from "../config/player360-privacy.config.js";
import { PrivacyAccessEvaluator } from "../domain/player360/PrivacyAccessEvaluator.js";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const BASE = {
  authenticated: true,
  basePermission: true,
  scopeAllowed: true,
  actorUserId: "user-1",
  playerId: "player-1",
  teamSeasonId: "team-season-1",
  module: "nutrition",
  sensitivity: "WELLNESS_RESTRICTED",
  action: PLAYER360_PRIVACY_ACTION.READ,
  purpose: PLAYER360_PRIVACY_PURPOSE.SPORT_PERFORMANCE,
  subjectRelation: PLAYER360_SUBJECT_RELATION.STAFF,
  now: NOW
};

const authorization = {
  player_id: "player-1",
  team_season_id: "team-season-1",
  modules: ["nutrition", "recovery"],
  purposes: ["SPORT_PERFORMANCE", "PLAYER_SELF_SERVICE", "FAMILY_SUPPORT"],
  legal_basis: "EXPLICIT_CONSENT",
  special_category_condition: "EXPLICIT_CONSENT",
  ai_processing_allowed: false,
  status: "ACTIVE",
  valid_from: "2026-09-01T00:00:00.000Z",
  valid_until: "2027-07-01T00:00:00.000Z"
};

const grant = {
  user_id: "user-1",
  player_id: "player-1",
  team_season_id: "team-season-1",
  modules: ["nutrition"],
  purposes: ["SPORT_PERFORMANCE"],
  actions: ["READ", "UPDATE"],
  status: "ACTIVE",
  valid_from: "2026-09-01T00:00:00.000Z",
  valid_until: "2027-07-01T00:00:00.000Z"
};

assert.equal(
  PrivacyAccessEvaluator.evaluate({
    authenticated: false,
    basePermission: true,
    scopeAllowed: true,
    sensitivity: "STANDARD"
  }).allowed,
  false,
  "Una sesión anónima nunca puede superar ABAC."
);

assert.deepEqual(
  PrivacyAccessEvaluator.evaluate({
    ...BASE,
    sensitivity: "STANDARD",
    processingAuthorization: null,
    accessGrant: null
  }),
  {
    allowed: true,
    reason: "ALLOW_STANDARD_RBAC",
    obligations: {
      audit: false,
      noClientProviderSecrets: false,
      humanReview: false,
      explicitExportGrant: false
    }
  },
  "STANDARD debe seguir usando RBAC + scope sin exigir autorizaciones wellness."
);

assert.equal(
  PrivacyAccessEvaluator.evaluate({
    ...BASE,
    sensitivity: "PRIVATE_SPORTING",
    processingAuthorization: null,
    accessGrant: null
  }).allowed,
  true,
  "PRIVATE_SPORTING conserva RBAC + scope en esta fase."
);

const staffWithoutAuthorization = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  accessGrant: grant
});
assert.equal(staffWithoutAuthorization.allowed, false);
assert.equal(staffWithoutAuthorization.reason, "DENY_PROCESSING_AUTHORIZATION");

const staffWithoutGrant = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  processingAuthorization: authorization
});
assert.equal(staffWithoutGrant.allowed, false);
assert.equal(staffWithoutGrant.reason, "DENY_EXPLICIT_GRANT");

const staffAllowed = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  processingAuthorization: authorization,
  accessGrant: grant
});
assert.equal(staffAllowed.allowed, true);
assert.equal(staffAllowed.reason, "ALLOW_RESTRICTED_EXPLICIT_GRANT");
assert.equal(staffAllowed.obligations.audit, true);

const superadminWithoutGrant = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  actorUserId: "superadmin-1",
  processingAuthorization: authorization,
  accessGrant: null,
  // The evaluator does not receive or honor a SUPERADMIN bypass flag.
  subjectRelation: PLAYER360_SUBJECT_RELATION.STAFF
});
assert.equal(superadminWithoutGrant.allowed, false);
assert.equal(superadminWithoutGrant.reason, "DENY_EXPLICIT_GRANT");

const selfRead = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  actorUserId: "player-user-1",
  purpose: PLAYER360_PRIVACY_PURPOSE.PLAYER_SELF_SERVICE,
  subjectRelation: PLAYER360_SUBJECT_RELATION.SELF,
  processingAuthorization: authorization,
  accessGrant: null
});
assert.equal(selfRead.allowed, true);
assert.equal(selfRead.reason, "ALLOW_RESTRICTED_SELF");

const guardianRead = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  actorUserId: "guardian-1",
  purpose: PLAYER360_PRIVACY_PURPOSE.FAMILY_SUPPORT,
  subjectRelation: PLAYER360_SUBJECT_RELATION.GUARDIAN,
  processingAuthorization: {
    ...authorization,
    representative_user_id: "guardian-1"
  },
  accessGrant: null
});
assert.equal(guardianRead.allowed, true);
assert.equal(guardianRead.reason, "ALLOW_RESTRICTED_GUARDIAN");

const wrongGuardian = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  actorUserId: "guardian-2",
  purpose: PLAYER360_PRIVACY_PURPOSE.FAMILY_SUPPORT,
  subjectRelation: PLAYER360_SUBJECT_RELATION.GUARDIAN,
  processingAuthorization: {
    ...authorization,
    representative_user_id: "guardian-1"
  },
  accessGrant: null
});
assert.equal(wrongGuardian.allowed, false);
assert.equal(wrongGuardian.reason, "DENY_EXPLICIT_GRANT");

const expiredAuthorization = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  processingAuthorization: {
    ...authorization,
    valid_until: "2026-09-02T23:59:59.000Z"
  },
  accessGrant: grant
});
assert.equal(expiredAuthorization.allowed, false);
assert.equal(expiredAuthorization.reason, "DENY_PROCESSING_AUTHORIZATION");

const wrongPurpose = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  purpose: PLAYER360_PRIVACY_PURPOSE.RESEARCH,
  processingAuthorization: {
    ...authorization,
    purposes: ["RESEARCH"]
  },
  accessGrant: {
    ...grant,
    purposes: ["RESEARCH"]
  }
});
assert.equal(wrongPurpose.allowed, false);
assert.equal(wrongPurpose.reason, "DENY_UNSUPPORTED_PURPOSE");

const aiWithoutOptIn = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  action: PLAYER360_PRIVACY_ACTION.AI_PROCESS,
  processingAuthorization: authorization,
  accessGrant: {
    ...grant,
    actions: ["AI_PROCESS"]
  }
});
assert.equal(aiWithoutOptIn.allowed, false);
assert.equal(aiWithoutOptIn.reason, "DENY_AI_PROCESSING_NOT_AUTHORIZED");
assert.equal(aiWithoutOptIn.obligations.noClientProviderSecrets, true);
assert.equal(aiWithoutOptIn.obligations.humanReview, true);

const aiAllowed = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  action: PLAYER360_PRIVACY_ACTION.AI_PROCESS,
  processingAuthorization: {
    ...authorization,
    ai_processing_allowed: true
  },
  accessGrant: {
    ...grant,
    actions: ["AI_PROCESS"]
  }
});
assert.equal(aiAllowed.allowed, true);
assert.equal(aiAllowed.obligations.audit, true);
assert.equal(aiAllowed.obligations.noClientProviderSecrets, true);
assert.equal(aiAllowed.obligations.humanReview, true);

const exportWithoutGrant = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  actorUserId: "player-user-1",
  action: PLAYER360_PRIVACY_ACTION.EXPORT,
  purpose: PLAYER360_PRIVACY_PURPOSE.PLAYER_SELF_SERVICE,
  subjectRelation: PLAYER360_SUBJECT_RELATION.SELF,
  processingAuthorization: authorization,
  accessGrant: null
});
assert.equal(exportWithoutGrant.allowed, false);
assert.equal(exportWithoutGrant.reason, "DENY_EXPORT_NOT_AUTHORIZED");
assert.equal(exportWithoutGrant.obligations.explicitExportGrant, true);

const mismatchedPlayerGrant = PrivacyAccessEvaluator.evaluate({
  ...BASE,
  processingAuthorization: authorization,
  accessGrant: {
    ...grant,
    player_id: "another-player"
  }
});
assert.equal(mismatchedPlayerGrant.allowed, false);
assert.equal(mismatchedPlayerGrant.reason, "DENY_EXPLICIT_GRANT");

console.log("PLAYER360_PHASE4E_PRIVACY_ABAC_OK");
