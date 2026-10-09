/**
 * Plans and what they unlock. There is no billing yet (decision D33), so
 * everyone is on Free and early access unlocks the Pro switches. When billing
 * arrives, only `currentPlan` and `EARLY_ACCESS` change — features already ask
 * this module rather than deciding for themselves.
 */
export type Plan = "free" | "pro" | "teams";

/** Everything is free while the product is in early access. */
export const EARLY_ACCESS = true;

export function currentPlan(): Plan {
  return "free";
}

export interface Entitlements {
  /** Turn off the "Made with" link in signatures. */
  removeBadge: boolean;
}

export function entitlements(plan: Plan = currentPlan()): Entitlements {
  const paid = plan !== "free";
  return { removeBadge: paid || EARLY_ACCESS };
}
