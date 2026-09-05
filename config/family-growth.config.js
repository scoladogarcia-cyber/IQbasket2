/**
 * @fileoverview Growth and monetization experiment configuration for IQBasket Family.
 * @description Commercial experiments live here; RBAC/ABAC and entitlements never
 * depend on these values. Checkout remains disabled until billing is connected.
 */
export const FamilyGrowthStage = Object.freeze({
  START: "START",
  BUILDING_HISTORY: "BUILDING_HISTORY",
  INSIGHT_READY: "INSIGHT_READY",
  DEVELOPMENT: "DEVELOPMENT",
  ACTION_LOOP: "ACTION_LOOP"
});

export const FAMILY_GROWTH_CONFIG = Object.freeze({
  minimumGamesForInsightOffer: 5,
  minimumGamesForTrendNarrative: 6,
  checkoutEnabled: false,
  priceDisplayEnabled: false,
  aiProductsAvailable: false,
  analyticsSurface: "FAMILY_WORKSPACE",
  experimentKey: "FAMILY_VALUE_V1"
});

/**
 * Internal-only price hypotheses. They are not rendered while priceDisplayEnabled=false.
 * Amounts are centralized so they can later move to the billing provider/catalog.
 */
export const FAMILY_PRICE_HYPOTHESES = Object.freeze({
  A: Object.freeze({
    FAMILY: Object.freeze({ monthlyCents: 799, annualCents: 7990 }),
    FAMILY_PRO: Object.freeze({ monthlyCents: 1499, annualCents: 14990 })
  }),
  B: Object.freeze({
    FAMILY: Object.freeze({ monthlyCents: 899, annualCents: 8990 }),
    FAMILY_PRO: Object.freeze({ monthlyCents: 1699, annualCents: 16990 })
  })
});

export const FAMILY_GROWTH_COPY = Object.freeze({
  valuePromise: "Entiende cómo evoluciona tu jugador y qué necesita para seguir creciendo.",
  freePromise: "Toda su trayectoria deportiva, siempre accesible.",
  familyPromise: "Convierte historial en evolución comprensible y objetivos claros.",
  proPromise: "Convierte la evolución en un plan recurrente de acción."
});
