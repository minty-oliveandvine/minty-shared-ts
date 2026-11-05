/**
 * The chat's few icons as inline SVG (the Material Symbols Rounded 400 paths), not the icon font:
 * the classic apps load different faces of it (minty-web and minty-payment-request-web the
 * Outlined one, minty-onboarding-web none at all), and a ligature in a missing face renders as
 * the word "close". Decorative - every control that holds one carries its own label.
 */

import { CAT_STILL } from "./assets";

const svg = (path: string, size: number) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
);

export const CloseGlyph = () =>
  svg(
    "M480-438 270-228q-9 9-21 9t-21-9q-9-9-9-21t9-21l210-210-210-210q-9-9-9-21t9-21q9-9 21-9t21 9l210 210 210-210q9-9 21-9t21 9q9 9 9 21t-9 21L522-480l210 210q9 9 9 21t-9 21q-9 9-21 9t-21-9L480-438Z",
    24,
  );

export const SendGlyph = () =>
  svg(
    "M814-452 162-178q-15 6-28.5-2.5T120-205v-550q0-16 13.5-24.5T162-782l652 274q18 8 18 28t-18 28ZM180-253l544-227-544-230v168l242 62-242 60v167Zm0 0v-457 457Z",
    20,
  );

export const ChatGlyph = () =>
  svg(
    "M240-240 131-131q-14 14-32.5 6.34Q80-132.31 80-152v-668q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240Zm-26-60h606v-520H140v600l74-80Zm-74 0v-520 520Zm130-99h253q12.75 0 21.38-8.68 8.62-8.67 8.62-21.5 0-12.82-8.62-21.32-8.63-8.5-21.38-8.5H270q-12.75 0-21.37 8.68-8.63 8.67-8.63 21.5 0 12.82 8.63 21.32 8.62 8.5 21.37 8.5Zm0-130h420q12.75 0 21.38-8.68 8.62-8.67 8.62-21.5 0-12.82-8.62-21.32-8.63-8.5-21.38-8.5H270q-12.75 0-21.37 8.68-8.63 8.67-8.63 21.5 0 12.82 8.63 21.32 8.62 8.5 21.37 8.5Zm0-130h420q12.75 0 21.38-8.68 8.62-8.67 8.62-21.5 0-12.82-8.62-21.32-8.63-8.5-21.38-8.5H270q-12.75 0-21.37 8.68-8.63 8.67-8.63 21.5 0 12.82 8.63 21.32 8.62 8.5 21.37 8.5Z",
    20,
  );

export const AddGlyph = () =>
  svg(
    "M450-450H230q-12.75 0-21.37-8.68-8.63-8.67-8.63-21.5 0-12.82 8.63-21.32 8.62-8.5 21.37-8.5h220v-220q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v220h220q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32-8.63 8.5-21.38 8.5H510v220q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-220Z",
    20,
  );

/** The Minty cat, still, from the app's own `public/` (CONTACT_ASSETS). */
export function MintyAvatar({ size, className = "" }: { size: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a packaged component cannot use next/image's loader config
    <img
      src={CAT_STILL}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 select-none object-contain ${className}`}
    />
  );
}
