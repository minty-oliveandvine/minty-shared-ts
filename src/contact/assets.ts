/**
 * Every file under `public/` the cat and its chat render - a contract, like `SIDEBAR_ASSETS`:
 * Next.js cannot serve a file out of node_modules, so each app holds it and asserts this list
 * against its own `public/` in a test. The cat is minty-www's `public/support/minty-mascot-chat.webp`
 * cut down to 256px (2x the 112px cat, rounded up).
 */
export const CONTACT_ASSETS = ["/contact/minty-cat.webp"] as const;
