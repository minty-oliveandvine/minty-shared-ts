# minty-shared-ts (`@minty/shared`)

Minty's shared TypeScript for the **Next.js** apps: the design tokens, the sidebar, the Part 14
primitives (`@minty/shared/ui`, since v0.3) and the modules every app used to carry a copy of. Part 3 step 4 of
`Minty/docs/modernisation/modernisation_plan.md`, brought forward on 2026-10-12.

Flask is not a consumer and never will be - its templates keep their own sidebar and CSS, and
retire in Part 3. `minty-www` cannot consume this either (Tailwind v3, React 18, Next 14); it
carries the same font stacks in its own `tailwind.config.ts`, so **change the two together**.

| Consumer                    | `theme.css` | the modules                                                 |
| --------------------------- | ----------- | ----------------------------------------------------------- |
| `minty-web`                 | yes         | yes                                                         |
| `minty-payment-request-web` | yes         | yes                                                         |
| `minty-onboarding-web`      | yes         | yes (money, dates, env, errorCopy, emailInput, clientValue) |
| `minty-petty-cash-web`      | yes         | yes, and the first consumer of `ui`                         |

## The shared modules and presets (v0.7)

Every app's `development` takes these instead of its own copy (the shared-code refactor, owner
2026-10-21). Each `main` keeps its own code until `development` is promoted. Behaviour is one rule
per concern; each module's header comment and tests are the specification.

| Subpath         | What it is                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./money`       | `formatMoney` ("HKD 1,234.50" - the code, a non-breaking `CODE_SPACE`, the currency's places), `formatPrice` (prices on the onboarding and subscription screens: a trailing ".00" dropped), `formatAmount`, `parseAmount` (null, never a silent 0), `acceptAmountInput`, `formatAmountTyping` / `formatCountTyping` (commas as you type, caret kept; v0.9) |
| `./dates`       | `HK_TIME_ZONE`, `isoDateInTimeZone(tz, d)`, `todayIso`, `daysFromToday`, `MONTHS`, `formatDay` ("05 Sep 2026", "" for a non-date), `formatInstantDay`                                                                                                                                                                                                      |
| `./apiClient`   | `ApiError`, `withQuery`, `readBody`, `errorSentence`, `HOUSE_FALLBACK`, `SESSION_ENDED`, `createBearerClient` (each app's 401 rule is its `onUnauthorized` callback)                                                                                                                                                                                       |
| `./errorCopy`   | `friendlyError`, `errorCopy`, `readsAsProse`, `resolveApiErrorMessage`, `statusFallback` - machine text never reaches a person                                                                                                                                                                                                                             |
| `./auth`        | `createCookieAuth({ prefix, maxAge? })`, `decodeJwtPayload`, `secondsUntilExpiry`, `isTokenExpired`, `isTokenExpiringSoon`, `moduleClaims`                                                                                                                                                                                                                 |
| `./handoff`     | `createHandoff`, `hubHandoffUrl`, `flaskHandoffUrl`, `mintyEntryUrl`, `logoutUrl` (no React)                                                                                                                                                                                                                                                               |
| `./landing`     | `useLandingHandoff`, `readLanding` ("use client" - the `/landing` page)                                                                                                                                                                                                                                                                                    |
| `./portal`      | `createProfileApi`, `fetchAllSubscriptions`, `loadViewer`, the Portal types                                                                                                                                                                                                                                                                                |
| `./amountInput` | `useAmountInput({ value, onValue, kind, decimals })` - spread on a controlled `<input>`: commas as the person types, the caret kept on its digit, places padded on blur; `kind: "count"` for whole numbers (v0.9, owner 2026-10-26)                                                                                                                        |
| `./clientValue` | `useClientValue`, `useMounted`                                                                                                                                                                                                                                                                                                                             |
| `./env`         | `envUrl(name, raw, devFallback)` - throws in a production build when the variable is unset                                                                                                                                                                                                                                                                 |
| `./download`    | `saveBlob(blob, filename)`, `saveTextFile`, `filenameFromDisposition`                                                                                                                                                                                                                                                                                      |
| `./proxy`       | `toFlask` - the hand-over to Flask, a meta-refresh page on preview-set hosts                                                                                                                                                                                                                                                                               |
| `./companyRef`  | also `companyPath`, `companyRefFromPath`, `addressCompanyRef` and the cross-app settings URLs                                                                                                                                                                                                                                                              |

Config presets (plain `.mjs`/`.json` with `.d.mts` types - Node, Next, Vitest and Playwright will
not strip types from `.ts` under `node_modules`): `./tsconfig.base.json`, `./prettier`, `./eslint`,
`./vitest` (`mintyVitest`), `./playwright` (`mintyPlaywright`, `PHONE`), `./next`
(`withMintyDefaults`, `securityHeaders`), `./e2e` (the hand-off token, credentials, `reachable`,
`expectNoSideScroll`, and `companyRef` as JS - `config/companyRef.mjs`, tested equal to the `.ts`).

## Installing

```
npm install "git+https://github.com/minty-oliveandvine/minty-shared-ts.git#v0.2"
```

npm will normalise that to `github:minty-oliveandvine/minty-shared-ts#v0.2` in `package.json`
and to a `git+ssh://` URL in `package-lock.json` whatever you type. **That is expected and it
works**, because this repo is public: npm falls back to HTTPS, so `npm install` and `npm ci` both
succeed with no SSH key anywhere (verified 2026-10-12 with ssh forced to fail). Making this repo
private would break every consumer's CI and Vercel build until a deploy key existed.

**Tags are immutable.** A tag is cut from `main` and never moved - unlike the `.github` repo's
`v1`, which moves by design. npm caches git dependencies, so a moved tag hands two machines
different code under one pin. No `#main` or `#development` pins anywhere.

## What a consumer must add

Two things for the tokens, two more for the components.

```css
/* app/globals.css */
@import "tailwindcss";
@import "@minty/shared/theme.css"; /* the tokens - plain CSS, fails loudly if wrong */
@import "anything/else.css"; /* every other @import comes next */
@source "../node_modules/@minty/shared/src"; /* ONLY if you render the components - see below */
```

**`@source` goes after every `@import`.** CSS requires imports to precede other rules, so an
`@source` above one silently invalidates it: placed above minty-payment-request-web's checkbox
import, it would have dropped those styles with no error anywhere.

```ts
// next.config.ts
transpilePackages: ["@minty/shared"],       // this package ships .ts source, not a build

// vitest.config.ts - Vitest does not read transpilePackages
server: { deps: { inline: ["@minty/shared"] } },
```

### The `@source` line is not optional, and nothing tells you when it is missing

Tailwind v4 **never scans `node_modules`**. Without `@source`, every utility class inside a
packaged component is dropped from the generated CSS - the sidebar renders as unstyled stacked
text, with no error anywhere. (This already drove `minty-onboarding-web/components/ModalFrame.tsx`
to hand-written CSS before the package existed.) The path is relative to the stylesheet, not the
package name: Tailwind resolves it as a path, and a bare `@minty/shared` would match nothing -
silently.

`theme.css` is different: a plain `@import` resolved by the bundler, exactly like
`material-symbols/outlined.css`. Misspell it and the build fails.

### `tokens.css` - the Part 13 design tokens (the sidebar needs them)

```css
@import "@minty/shared/theme.css";
@import "@minty/shared/tokens.css"; /* colour, radius, type, elevation - Part 13 v1.1 */
```

The Minty v2 tokens from `Minty/docs/design/part-13-visual-design-system.md`: `--minty-*`
primitives in `:root`, and the semantic roles (`--color-action-primary`, `--color-text-secondary`,
`--color-status-info-bg` ...), the radius scale (`rounded-lg` = 12px), the type styles
(`text-body-m`, `text-label` ...) and two shadows in `@theme`, so they generate utilities. Screens
bind to the semantic roles only, never a hex. **The sidebar's classes use them**, so a consumer
that renders it must import this file - without it the menu draws in Tailwind's defaults. Dark
values exist under `:root[data-theme="dark"]` and nothing sets that attribute yet (Light at
launch, D-24). Note it redefines Tailwind's `--radius-sm/md/lg/xl`: that is the Part 13 scale.

### The sidebar rail (opt-in)

`<SidebarProvider rail>` keeps the menu on screen as a fixed 280px rail on the right from 1280px
(Part 14 / 15 "One layout", D14-15); below that it stays the sheet the ≡ opens, and the ≡ hides
where the rail shows. The page's outer frame must carry `SIDEBAR_RAIL_OFFSET` (exported from
`@minty/shared/sidebar`) so nothing sits under the rail. Without `rail` nothing changes.

### The sidebar's look (v0.4)

From v0.4 the sidebar draws minty-web's Minty v2 look (the owner's choice, 2026-10-15) in place
of v0.2's compact Part 13 restyle: a 353px sheet, 44px rows in `text-title-l`, the module
headings with their 76px icons on the right, the 99px logo and a 28px header badge. Only the
classes changed - the host, the rail, the scroll lock and every behaviour are v0.3's. The rail
was drawn for the compact look; this geometry has not been checked inside its 280px yet, so
check it before a consumer turns `rail` on.

From v0.5 the sheet casts its `shadow-overlay` only while open. Closed, it waits just past the
right edge, and in v0.4 its shadow fell back onto every page as a faint strip about 20px wide.

### Two designs: `look="classic"` and `look="v2"` (v0.6)

The owner (2026-10-20): the sidebars are shared, in two designs - **`classic`**, minty-web
`main`'s original (v0.1 of this package), on every `main` branch; and **`v2`**, the redesign
above, on every `development` branch. One implementation - behaviour, host, rail and scroll lock
are the same - with two sets of classes (`src/sidebar/looks.ts`, `src/profile/looks.ts`):

```tsx
<SidebarProvider look="classic" profile={…}>   // main branches
<SidebarProvider profile={…}>                    // development: v2 is the default
```

My Profile and its Subscriptions Overview follow the provider's look (or take `look` themselves,
for a page drawn outside a sidebar). `classic` is kept verbatim from the originals with two
mechanical substitutions, so it needs neither the app's old tokens nor `tokens.css`:
minty-web main's colour tokens written in as values (`primary` #656565, `accent` #f15a24,
`teal-strong` #18c4c7, avatar #ffe6b1 / #6b3a12), and Tailwind's radius steps as pixels
(`tokens.css` redefines `rounded-md/-lg/-xl`). That is the one sanctioned exception to "never a
hex" - including its Brand #54D3DA button fills - because it is the original preserved, not a new
screen. Every `classic` class was traced back to its source (86 slots, 2026-10-20); a test keeps
Part 13 classes and the redefined radius steps out of it. Both looks drop the PASSWORD row, and
both keep the two fixes made since v0.1: the panel fills the sheet, and the sheet's shadow only
while open.

Each consumer keeps a test that compiles its real `app/globals.css` through its real
`@tailwindcss/postcss` and asserts the tokens and the packaged declarations are in the output.
That test is the only thing standing between a lost line and a broken page.

### `public/` assets

The menu renders fifteen files under `/menu/`. Next cannot serve a static file out of
`node_modules`, so **they live in each app's `public/`**. `SIDEBAR_ASSETS` (exported from
`@minty/shared/sidebar`) is the list; each consumer asserts its `public/` against it, because a
missing file is a broken image rather than an error.

### The Part 14 primitives (`@minty/shared/ui`)

Button, Field, ErrorSummary, InlineAlert / PageBanner, Modal / Drawer, StatusPill, EmptyState,
FilterChip, SegmentedControl, PageHeader, Skeleton and Icon - built in minty-payment-request-web's
Part 13-15 migration (2026-10-13) and lifted here in v0.3. They draw only with the semantic token
utilities of `tokens.css`, so a consumer needs that sheet and the `@source` line. Two changes
from the app's copies:

- `StatusPill` takes its `tone` as a prop. Which status is which tone is each app's own map (its
  `lib/statusTone.ts`); the five tones and their colours (`TONE_CLASS`) are here.
- `Modal` / `Drawer` hold the page still through `@minty/shared/scrollLock` (reference counted;
  the element with id `app-scroll-root` when the app has one, else the body). An app's sidebar
  host can hand the same lock to `lockScroll`, so a drawer over the menu shares one count.

`UI_ASSETS` lists the `public/` files they render (`/cat-hole.png` for the first-use empty state),
under the same contract as `SIDEBAR_ASSETS`.

minty-payment-request-web still renders its own copies; it moves to these in its own task.

### My Profile (`@minty/shared/profile`, v0.6)

The sidebar's second view: My Profile opens over the page, never as a page of its own (the
owner, 2026-10-20). It was a copy per app (minty-web's `features/profile` the original); since
v0.6 it is one `ProfilePanel`, drawn in the shared tokens - the same values minty-web's app
tokens held, so the look did not move. No PASSWORD row: Minty holds no password (the owner,
2026-10-20).

v0.10: the email's shape is checked. Besides blank ("We'll need an email here.") and non-English,
an email that is not an address (`isEmail`) is refused before anything is sent - "That email
address doesn't look right." - shown under the field once it has been left or Save tried, and
gone as soon as a valid one is typed. The names stay optional.

```tsx
<SidebarProvider profile={<ProfilePanel api={profileApi} notify={toast} />}>
```

- `api` - the app's two Flask calls, `load(entityId, signal)` and `save(changes, entityId)` over
  its own bearer fetch (`GET` / `PATCH /api/me/profile`). A refusal rejects with
  `{ status, message }` and the message is shown as it stands; a 401 shows nothing (the app is
  already re-signing in); anything else gets the panel's own words. Keep it module-level: a new
  object per render reads the profile again.
- `notify(message, kind)` - the app's toast.
- `subscriptions` - optional; normally the packaged `SubscriptionsOverviewCard`.
- From the host it takes `entityId()` (the company named) and `logOut()`.

`SubscriptionsOverviewCard load={…}` is the profile's "Subscriptions Overview" (10-A/10-B):
"Active subscriptions" and "Trial ending" counted as minty-web's portal counts them
(`overviewFigures`, its `overview` and `calendarDays` lifted - change them together), and Manage
Subscription to the host's `links.subscriptions()`. `load(signal)` is the app's read of
subscription-api's `GET /api/me/subscriptions`, every page, resolving `{ entities }`; same refusal
rules as `api`.

`PROFILE_ASSETS` lists its five `public/profile/` files, under the same contract as
`SIDEBAR_ASSETS`. minty-web and minty-payment-request-web still render their own copies (with
the PASSWORD row) until they bump past v0.5 - a change to the panel touches all of them until then.

## The host

Everything that differs per app comes through one object, which the app registers:

```ts
// components/ui/sidebarHost.ts  - the ONE app-specific file
import { setSidebarHost, type SidebarHost } from "@minty/shared/sidebar";

export const sidebarHost: SidebarHost = {/* ... */};
setSidebarHost(sidebarHost);
```

It answers: the company in the cookie and its name, which modules it has, where each menu item
leads **from this app**, which path means which menu item, how the page's scroll is held, what
Logout owes (including any "Leave without saving?"), the current token, and who is looking. See
`src/host.ts` - it is the shape of `minty-payment-request-web`'s own `sidebarHost.ts`, which was
written as the design for it.

Three of its fields exist for reasons that each cost a debugging session to find:

- **`app`** (`"minty-web"`, `"minty-payment-request-web"`). The "one page, one app" guard keys on
  this name and NOT on object identity: Next evaluates a host module once per bundler layer and
  again on **every HMR edit**, so one file legitimately produces several distinct objects in a
  single page. Identity threw "a second, different sidebar host" on an ordinary dev reload.
  Re-registering the same app replaces the host, which is what HMR needs - the old object closes
  over the modules it was built from.
- **`usePathname()`** - the app's router, as a hook. This package imports no `next/navigation` at
  all, because `vi.mock("next/navigation")` in a consumer's test **does not reach a module inside
  `node_modules`**: a packaged component read the real hook, got `null` outside an app-router tree,
  and the sidebar stopped closing on a move between pages. Asking the app means the app's own mock
  applies. (`SideMenu` still reads `window.location.pathname` - it is drawn in the drawer's portal
  and re-rendered whenever it opens, and a screen test renders it with no router at all.)
- **`loadViewer()`** rather than a fetcher, because the two apps' clients disagree about what a 401
  means (`"handoff"` vs `"reauth"`) and a shared fetch type would have to widen one of them.

A module-level registry, not a React provider, for two reasons that are not style: every app's
`app/layout.tsx` is a **server** component, so functions cannot be passed across that boundary as
props; and `src/lib/viewer.ts` is a module-level store whose reads happen outside any React tree.
An unregistered host **throws**, naming the file to write - there is no silent default.

Each consumer keeps thin shims at the old paths (`components/ui/Sidebar.tsx` and friends) whose
first line imports its `sidebarHost` for the side effect. That is what guarantees the host is
registered before anything renders, and it means no page, feature or test had to change.

**One trap that lands in the consumer's tests:** a `test/setup.ts` importing a shim at the TOP of
the file pulls the host, and with it `next/navigation`, into memory before any test file's
`vi.mock` is registered - binding the real modules for good. Import it inside the hook instead.
Both consumers do.

## Preview sets (`@minty/shared/previewSibling`)

A branch's previews are one set of hosts, `pr-<slug>-<app>.dailyminty.com`, which the `.github`
repo's `vercel-preview-set.yml` keeps complete (the branch's build where a repo has the branch,
the fallback build where it does not). The apps are `my`, `payment-request`, `onboarding`,
`pettycash` (`petty-cash` until 0.5, renamed with its hosts `pettycash.` / `dev-pettycash.`) and
`www`. `siblingUrl(configuredUrl, app, currentHost)` moves a
sibling app's URL into the set the page is served from, and returns it untouched on every other
host. Pass the host the page is actually on - `window.location.host` in the browser, `headers()`
in a server component, `request.nextUrl.host` in middleware - never a build-time value, because
the fallback build is a production build that must still stay inside the set. No React or Next
imports, so it is safe in edge middleware.

`withReturnOrigin(url, origin?)` adds `return_origin` to an address on Minty (Flask), so Flask
can hand back into the set; every trip an app makes to Flask goes through it.

## Working on it

```
npm install      # once
npm run typecheck
npm run lint
npm test
```

No `@/` alias here, deliberately: `tsconfig.paths` does not apply inside `node_modules`, so an
aliased import would resolve in this repo and fail in a consumer's build. Imports are relative,
and anything app-specific is asked of the host. `eslint` fails on `@/` for that reason.

No root export either - `exports` lists one subpath per module. `minty-payment-request-web`'s edge
`middleware.ts` imports `companyRef`, and a barrel would drag `react` and `next/navigation` into
the middleware bundle.

Tests for the lifted modules live here now and were deleted from the apps - one implementation,
one suite. Each app keeps its own `Sidebar.test.tsx`, which tests **its** wiring; those two
diverged 313 lines on purpose and are not reconciled.

### Releasing

`development` -> green -> `main` -> `git tag -a vX.Y` on `main` -> push the tag. Then each
consumer bumps its pin on a branch, so that app's own CI and a Vercel **preview** build prove the
new tag before `development` moves. Never push a pin bump straight to `development`: production
builds from it.
