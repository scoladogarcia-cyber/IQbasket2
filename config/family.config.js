/**
 * @fileoverview Product contract for the IQBasket family experience.
 * @description Commercial labels and UX grouping only. Authorization remains
 * in RBAC/ABAC and entitlement decisions remain server-side.
 */
import { EntitlementCode } from "../security/entitlements.js";

export const FamilyPlanCode = Object.freeze({
  FREE: "FAMILY_FREE",
  FAMILY: "FAMILY",
  PRO: "FAMILY_PRO"
});

export const FAMILY_PLAN_PRESENTATION = Object.freeze({
  [FamilyPlanCode.FREE]: Object.freeze({
    label: "Family Free",
    eyebrow: "Tu historia deportiva",
    description: "Trayectoria, partidos y estadísticas esenciales en un único lugar.",
    tier: 0
  }),
  [FamilyPlanCode.FAMILY]: Object.freeze({
    label: "Family",
    eyebrow: "Entiende la evolución",
    description: "Player360, objetivos, tecnificación e interpretación orientada al desarrollo.",
    tier: 1
  }),
  [FamilyPlanCode.PRO]: Object.freeze({
    label: "Family Pro",
    eyebrow: "Convierte datos en acción",
    description: "Inteligencia recurrente y planificación, siempre bajo permisos y privacidad.",
    tier: 2
  })
});
export const FAMILY_FEATURE_GROUPS = Object.freeze([
  Object.freeze({
    id: "passport",
    label: "Pasaporte",
    entitlements: Object.freeze([
      EntitlementCode.PLAYER_PROFILE,
      EntitlementCode.GAME_HISTORY,
      EntitlementCode.BASIC_STATS,
      EntitlementCode.BASIC_TIMELINE
    ])
  }),
  Object.freeze({
    id: "development",
    label: "Desarrollo",
    entitlements: Object.freeze([
      EntitlementCode.PLAYER360,
      EntitlementCode.PLAYER_GOALS,
      EntitlementCode.DEVELOPMENT_PLAN,
      EntitlementCode.TECHNIFICATION,
      EntitlementCode.FAMILY_INSIGHTS
    ])
  }),
  Object.freeze({
    id: "intelligence",
    label: "Inteligencia",
    entitlements: Object.freeze([
      EntitlementCode.AI_INSIGHTS,
      EntitlementCode.AI_WEEKLY_PLAN
    ])
  })
]);

export const FAMILY_PRODUCT_PRINCIPLES = Object.freeze({
  valueLadder: Object.freeze([
    "Qué pasó",
    "Cómo evoluciona",
    "Qué significa",
    "Qué hacemos ahora"
  ]),
  checkoutEnabled: false,
  sensitiveDataRequiresIndependentAuthorization: true
});
