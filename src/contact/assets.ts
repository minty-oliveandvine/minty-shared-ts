/**
 * Every file under `public/` the cat and its chat render - a contract, like `SIDEBAR_ASSETS`:
 * Next.js cannot serve a file out of node_modules, so each app holds them and asserts this list
 * against its own `public/` in a test.
 *
 * The cat is the owner's own clip (2026-11-05: "Manager Minty", the suited cat waving, its white
 * backdrop cut away), as an animated WebP with transparency at 192px, 12 frames a second, and an
 * open-eyed frame as a still: what shows at once and under reduced motion. The chat's header is the owner's headset
 * cat (same day), a 96px square drawn round. The tucked tab peeks with the owner's thinking cat
 * (2026-11-11, "Basic Minty 5": the question mark beside it), a 96px square drawn whole at 40px;
 * on the right edge it is mirrored with the "?" kept upright (`CAT_TAB_RIGHT`), so the "?" always
 * faces the page.
 */
export const CAT_STILL = "/contact/minty-cat.webp";
export const CAT_ANIMATED = "/contact/minty-cat-animated.webp";
export const CAT_SUPPORT = "/contact/minty-support.webp";
export const CAT_TAB = "/contact/minty-tab.webp";
export const CAT_TAB_RIGHT = "/contact/minty-tab-right.webp";

export const CONTACT_ASSETS = [
  CAT_STILL,
  CAT_ANIMATED,
  CAT_SUPPORT,
  CAT_TAB,
  CAT_TAB_RIGHT,
] as const;
