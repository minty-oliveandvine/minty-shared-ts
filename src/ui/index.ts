/**
 * The Part 14 primitives (Minty/docs/design/part-14-component-library.md), shared by every Next.js
 * app since v0.3 - lifted from minty-payment-request-web's `components/ui/`, where they were
 * built in its Part 13-15 migration (2026-10-13).
 *
 * Styled only with the semantic token utilities of `@minty/shared/tokens.css`, so an app that
 * imports this must also import that sheet and `@source` this package (README). Status tones are
 * here; which status gets which tone is each app's own map.
 */

export { Button, buttonClass, type ButtonKind } from "./Button";
export { EmptyState } from "./EmptyState";
export { ErrorSummary } from "./ErrorSummary";
export { Field, inputClass } from "./Field";
export { FilterChip } from "./FilterChip";
export { Icon } from "./Icon";
export { InlineAlert, PageBanner } from "./InlineAlert";
export { Drawer, Modal } from "./Overlay";
export { PageHeader } from "./PageHeader";
export { SegmentedControl } from "./SegmentedControl";
export { Skeleton } from "./Skeleton";
export { StatusPill } from "./StatusPill";
export { TONE_CLASS, type StatusTone } from "./statusTone";

/**
 * Every file under `public/` a packaged primitive renders - the same contract as
 * `SIDEBAR_ASSETS`: Next.js cannot serve a static file out of node_modules, so each consumer
 * holds these and asserts the list against its own `public/` in a test.
 */
export const UI_ASSETS = ["/cat-hole.png"] as const;
