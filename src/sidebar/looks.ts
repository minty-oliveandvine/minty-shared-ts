/**
 * The sidebar's two designs (the owner, 2026-10-20): ONE implementation, two sets of classes.
 *
 * - `v2` - the redesign, minty-web's "Minty v2" look (v0.4), on every `development` branch. Part 13
 *   semantic tokens from `@minty/shared/tokens.css`.
 * - `classic` - the original design, as minty-web's `main` draws it (and v0.1 of this package),
 *   on every `main` branch. Kept VERBATIM, with two mechanical substitutions so it needs nothing
 *   from the app or from `tokens.css`:
 *     - minty-web main's colour tokens written in as their values (`primary` #656565, `accent`
 *       #f15a24, `teal-strong` #18c4c7, `--avatar-bg` #ffe6b1, `--avatar-fg` #6b3a12);
 *     - Tailwind's own radius steps written in as pixels (`rounded-md` 6px, `-lg` 8px, `-xl`
 *       12px), because `tokens.css` redefines those steps to Part 13's scale.
 *   That is the one sanctioned exception to "never a hex": a legacy look preserved, not a new
 *   screen.
 *
 * A consumer picks one: `<SidebarProvider look="classic">`; the default is `v2`, so a v0.5
 * consumer is unchanged.
 */

export type Look = "classic" | "v2";

export const SIDEBAR_LOOK = {
  v2: {
    /* Sidebar.tsx */
    scrim: "bg-overlay-scrim ease-(--ease-standard)",
    sheet: "border-l border-border-default sm:rounded-l-xl ease-(--ease-standard)",
    sheetProfile: "w-full bg-surface-sunk sm:w-[440px]",
    sheetMenu: "w-[min(100%,353px)] bg-surface-card",
    sheetOpen: "translate-x-0 shadow-overlay",
    /* NavMenu.tsx */
    menuButton:
      "inline-flex size-11 cursor-pointer items-center justify-center rounded-lg transition-colors duration-100 hover:bg-state-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
    /* ViewerBadge.tsx: a 44px hit area around a 28px circle */
    badge:
      "group -m-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-border-focus",
    badgeCircle:
      "inline-flex size-7 items-center justify-center rounded-full bg-accent-avatar-bg text-label font-semibold text-accent-avatar-ink transition-shadow duration-100 group-hover:ring-2 group-hover:ring-border-selected/25",
    /* SideMenu.tsx */
    row: "flex min-h-11 w-full items-center rounded-md text-title-l font-medium transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
    idle: "text-text-muted hover:bg-state-hover aria-[current=page]:bg-state-selected aria-[current=page]:text-text-link",
    button: "bg-state-selected text-text-link hover:bg-state-hover",
    separator: "h-px w-full shrink-0 bg-border-subtle",
    moduleHeading: "flex items-center justify-between pl-5",
    moduleTitle: "text-title-l font-semibold",
    person:
      "mt-8 flex min-h-11 w-full cursor-pointer items-center gap-10 rounded-md py-1 pl-9 text-left transition-colors duration-100 hover:bg-state-hover aria-[current=page]:bg-state-selected focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
    avatar:
      "flex h-[57px] w-[56px] shrink-0 items-center justify-center rounded-full bg-accent-avatar-bg text-display-l font-medium text-accent-avatar-ink",
    name: "max-w-[130px] break-words text-title-l text-text-primary",
    nav: "flex min-h-full flex-col px-12 pt-[max(48px,env(safe-area-inset-top,0px))] pb-[max(40px,env(safe-area-inset-bottom,0px))]",
    logo: "ml-22 h-auto w-[99px] shrink-0",
    firstSeparator: "mt-8",
    topLinks: "mt-4 flex flex-col gap-1",
    selectEntity: "gap-5 pl-8",
    subscriptions: "gap-5 py-2 pl-8",
    secondSeparator: "mt-4",
    pettyGroup: "mt-6 flex flex-col",
    pettyTone: "text-text-primary",
    pettyIconBox: "bg-module-pettycash-wash",
    dashboard: "mt-4 gap-6 pl-5",
    reports: "gap-6 pl-5",
    moduleSeparator: "mt-6",
    paymentGroup: "mt-6 flex flex-col",
    paymentTone: "text-module-payment-ink",
    bills: "mt-7 gap-6 pl-4",
    spacer: "min-h-6 flex-1",
    cat: "flex shrink-0 justify-center pb-4",
    bottomLinks: "mt-4 flex flex-col gap-1",
    settings: "gap-4 pl-4",
    logout: "cursor-pointer gap-4 pl-4 text-left",
  },
  classic: {
    scrim: "bg-[#d9d9d9]/70 ease-out",
    // The shadow only while open, as in v2 (695ae34): closed, the sheet waits past the right edge
    // and its shadow fell back onto every page as a faint strip - a fix, not a look.
    sheet: "border border-[#ededed] ease-out",
    sheetProfile: "w-full bg-[#f9fafb] sm:w-[440px]",
    sheetMenu: "w-[min(100%,353px)] bg-white",
    sheetOpen: "translate-x-0 shadow-[-6px_4px_18px_0px_rgba(15,23,42,0.1)]",
    menuButton:
      "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[6px] transition-colors hover:bg-[#656565]/10",
    badge:
      "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#ffe6b1] text-[12px] font-semibold text-[#6b3a12] transition-shadow hover:ring-2 hover:ring-[#656565]/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#656565]",
    badgeCircle: undefined,
    row: "flex w-full items-center rounded-[12px] text-[18px] font-medium leading-[22px] transition-colors",
    idle: "text-[#8f8f8f] hover:bg-[#f5f5f5]",
    button: "bg-[rgba(202,241,244,0.5)] text-[#54d3da] hover:bg-[rgba(202,241,244,0.8)]",
    separator: "h-px w-full shrink-0 bg-[#ededed]",
    moduleHeading: "flex items-center justify-between pl-[19px]",
    moduleTitle: "text-[18px] font-bold leading-[22px]",
    person:
      "mt-[30px] flex w-full cursor-pointer items-center gap-[40px] rounded-[12px] py-[3px] pl-[35px] text-left hover:bg-[#f5f5f5]",
    avatar:
      "flex h-[57px] w-[56px] shrink-0 items-center justify-center rounded-[91px] bg-[#ffe6b1] text-[30px] font-medium text-[#6b3a12]",
    name: "max-w-[130px] break-words text-[18px] leading-[22px] text-[#1f2937]",
    nav: "flex min-h-full flex-col pl-[49px] pr-[53px] pt-[max(49px,env(safe-area-inset-top,0px))] pb-[max(42px,env(safe-area-inset-bottom,0px))]",
    logo: "ml-[89px] h-auto w-[99px] shrink-0",
    firstSeparator: "mt-[32px]",
    topLinks: "mt-[15px] flex flex-col gap-[3px]",
    selectEntity: "min-h-[52px] gap-[21px] pl-[32px]",
    subscriptions: "min-h-[66px] gap-[21px] pl-[32px]",
    secondSeparator: "mt-[16px]",
    pettyGroup: "mt-[25px] flex flex-col",
    pettyTone: "text-[#16202e]",
    pettyIconBox: "bg-[#f7efd9]",
    dashboard: "mt-[14px] min-h-[44px] gap-[24px] pl-[19px]",
    reports: "min-h-[44px] gap-[24px] pl-[19px]",
    moduleSeparator: "mt-[26px]",
    paymentGroup: "mt-[30px] flex flex-col",
    paymentTone: "text-[#2374f2]",
    bills: "mt-[28px] min-h-[41px] gap-[25px] pl-[17px]",
    spacer: "min-h-[24px] flex-1",
    cat: "flex shrink-0 justify-center pb-[16px]",
    bottomLinks: "mt-[14px] flex flex-col gap-[3px]",
    settings: "min-h-[52px] gap-[16px] pl-[14px]",
    logout: "min-h-[44px] cursor-pointer gap-[16px] pl-[14px] text-left",
  },
} as const satisfies Record<Look, Record<string, string | undefined>>;

export type SidebarLookClasses = (typeof SIDEBAR_LOOK)[Look];
