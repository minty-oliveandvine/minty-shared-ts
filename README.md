# minty-shared-ts (`@minty/shared`)

Minty's shared TypeScript for the **Next.js** apps: the design tokens, the sidebar, the Part 14
primitives (`@minty/shared/ui`, since v0.3) and the modules every app used to carry a copy of. Part 3 step 4 of
`Minty/docs/modernisation/modernisation_plan.md`, brought forward on 2026-10-12.

Flask is not a consumer and never will be - its templates keep their own sidebar and CSS, and
retire in Part 3. `minty-www` cannot consume this either (Tailwind v3, React 18, Next 14); it
carries the same font stacks in its own `tailwind.config.ts`, so **change the two together**.

| Consumer                    | `theme.css` | the modules                                                  |
| --------------------------- | ----------- | ------------------------------------------------------------ |
| `minty-web`                 | yes         | yes                                                          |
| `minty-payment-request-web` | yes         | yes                                                          |
| `minty-onboarding-web`      | yes         | not yet (opt-in, after its `{ok,error}` typing pass settles) |
| `minty-petty-cash-web`      | yes         | yes, and the first consumer of `ui`                          |

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
