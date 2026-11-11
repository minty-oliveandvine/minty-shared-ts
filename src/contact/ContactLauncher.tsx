"use client";

/**
 * The Minty cat at the bottom right of every app (owner, 2026-11-05): a pop-up on the cat lists
 * what it can do - always "Talk to Minty", plus whatever the page adds (minty-web's entity list
 * adds "Create company", which used to be its own floating +) - and "Talk to Minty" opens the
 * chat (`./ContactChat.tsx`), which ends by emailing the team through the app's `send`.
 *
 * Like `ProfilePanel`, the package never fetches: the app passes `send` (its own reach into
 * Flask's `POST /api/me/contact`) and its toast. The app id and the company come from the sidebar
 * host. Drawn only for someone signed in - the viewer is known - so the sign-in pages show no cat.
 *
 * The conversation lives here, not in the window, so closing and reopening the chat keeps it; a
 * sent message starts the next one fresh. Nothing is stored anywhere else.
 *
 * v0.15 (owner, 2026-11-09): the cat stood on a page's last controls (minty-payment-request-web's
 * pager), so it now leaves room for itself on a page that scrolls - an empty block its height at
 * the end, so whatever ends in the bottom-right corner can scroll up clear of it - and the pop-up's close
 * (x, "Tuck Minty away") leaves only a tab on the screen's edge, remembered in this browser
 * (`./tucked.ts`) until the tab is tapped. Escape still only closes the pop-up. The cat can also be
 * dragged anywhere on the screen and stays exactly where it is let go (`./place.ts`); a tap still
 * opens the pop-up.
 *
 * v0.18 (owner, 2026-11-11): the cat starts tucked - a browser that has never brought it out sees
 * only the tab - and bringing it back opens its pop-up at once, the first line focused.
 */

import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { requireSidebarHost } from "../host";
import { useViewer } from "../lib/viewer";
import { useLook, useSidebar } from "../sidebar/Sidebar";
import { useRegisteredContactActions, type ContactAction } from "./actions";
import { CAT_ANIMATED, CAT_STILL } from "./assets";
import { ContactChat } from "./ContactChat";
import { AddGlyph, ChatGlyph, CloseGlyph } from "./glyphs";
import { CONTACT_LOOK } from "./looks";
import type { Topic } from "./rules";
import { START, chatReducer, firstName } from "./script";
import { roomHost, usePageNeedsRoom } from "./pageRoom";
import { readPlace, readPlaceOnServer, setPlace, subscribePlace, type Place } from "./place";
import { readTucked, readTuckedOnServer, setTucked, subscribeTucked } from "./tucked";

/** What the app's `send` posts: Flask's `POST /api/me/contact` body. */
export type ContactMessage = {
  name: string;
  email: string;
  company: string;
  topic: Topic;
  message: string;
  app: string;
  entity?: string;
};

/** Flask's answer: where the reply goes (the email given, as accepted). */
export type ContactReceipt = { reply_to?: string | null };

export type ContactLauncherProps = {
  /**
   * Posts the message; rejects with an `Error` - or any `{ message }`, the shape `ProfilePanel`'s
   * refusals take - whose `message` is the sentence to show.
   */
  send: (message: ContactMessage) => Promise<ContactReceipt>;
  /** The app's toast - the same callback `ProfilePanel` takes. */
  notify: (message: string, kind: "success" | "error") => void;
  /** Lines shown above "Talk to Minty" on every page; a page adds its own with `useContactActions`. */
  actions?: ContactAction[];
  /** Draw nothing (a public page, e.g. Petty Cash's shared report). */
  hidden?: boolean;
  /**
   * Where the email comes from when the viewer has none (minty-onboarding-web: its hand-off
   * carries none). Called once a page, and only when Contact Support is opened - a page whose
   * visitor never asks reads nothing. Decoration: a failure offers no email, and says so on the
   * console.
   */
  loadEmail?: () => Promise<string | null>;
};

const SEND_FAILED = "We couldn't send your message just now. Try again in a moment.";
const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * The room the cat (or its tab) takes at the bottom of the screen, as a block at the end of the
 * page: its height, the gap under it, and 8px more. The cat is 96px, 112px from `sm`; the tab 56px.
 */
const CAT_CLEARANCE =
  "h-[calc(6rem_+_max(1rem,env(safe-area-inset-bottom))_+_0.5rem)] sm:h-[calc(7rem_+_max(1rem,env(safe-area-inset-bottom))_+_0.5rem)]";
const TAB_CLEARANCE = "h-[calc(3.5rem_+_max(1rem,env(safe-area-inset-bottom))_+_0.5rem)]";

/** A press that moves less than this is a tap, not a drag. */
const DRAG_PX = 6;
/** A dragged cat's spot, kept on screen however small the window gets (the cat is 7rem at most). */
function spotOf(place: Place): CSSProperties {
  return {
    right: `clamp(0px, ${place.right}px, calc(100vw - 7rem))`,
    bottom: `clamp(0px, ${place.bottom}px, calc(100dvh - 7rem))`,
  };
}

type Drag = {
  id: number;
  px: number;
  py: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
  moved: boolean;
};

/** The refusal's own sentence, or ours when it has none. */
function sentenceOf(err: unknown): string {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : SEND_FAILED;
}

export function ContactLauncher({
  send,
  notify,
  actions = [],
  hidden = false,
  loadEmail,
}: ContactLauncherProps) {
  const viewer = useViewer();
  const pageActions = useRegisteredContactActions();
  const look = CONTACT_LOOK[useLook()];
  const rail = useSidebar()?.rail ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const tucked = useSyncExternalStore(subscribeTucked, readTucked, readTuckedOnServer);
  const place = useSyncExternalStore(subscribePlace, readPlace, readPlaceOnServer);
  // While the cat is being dragged: where its box's top-left is, in the viewport.
  const [dragAt, setDragAt] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  // A drag ends in a click on the cat; this swallows that one click.
  const justDragged = useRef(false);
  const [state, dispatch] = useReducer(chatReducer, START);
  // The still cat shows at once; the animated one (about half a megabyte) replaces it once the
  // browser has it, and every later page takes it from the cache.
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const preload = new Image();
    preload.onload = () => setMoving(true);
    preload.src = CAT_ANIMATED;
    return () => {
      preload.onload = null;
    };
  }, []);
  const [loadedEmail, setLoadedEmail] = useState<string | null>(null);
  const emailAsked = useRef(false);
  const wantsEmail = Boolean(state.main && loadEmail && viewer && !viewer.email);

  // The email to offer, when the viewer has none: asked once a page, only once it is needed.
  useEffect(() => {
    if (!wantsEmail || emailAsked.current || !loadEmail) return;
    emailAsked.current = true;
    loadEmail()
      .then((email) => setLoadedEmail(email?.trim() || null))
      .catch((err: unknown) => {
        console.error("[contact] the email to suggest did not load", err);
      });
  }, [wantsEmail, loadEmail]);
  const cat = useRef<HTMLButtonElement>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const room = useRef<HTMLDivElement>(null);
  // Room only for the cat on its resting spot; one dragged elsewhere chose its own place.
  const needsRoom = usePageNeedsRoom(!hidden && Boolean(viewer) && place === null, room);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Set by a tuck or a bring-back, so focus follows to what is drawn in place of what was pressed.
  const focusAfterTuck = useRef(false);

  useEffect(() => {
    if (!focusAfterTuck.current) return;
    focusAfterTuck.current = false;
    (tucked ? tab : cat).current?.focus();
  }, [tucked]);

  // The pop-up: focus its first line on open; a click anywhere else closes it.
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !cat.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  if (hidden || !viewer) return null;

  const closeMenu = () => {
    setMenuOpen(false);
    cat.current?.focus();
  };

  const closeChat = () => {
    setChatOpen(false);
    if (state.step === "sent") dispatch({ type: "reset" });
    cat.current?.focus();
  };

  const onSend = async () => {
    const { answers } = state;
    if (!answers.topic) return;
    dispatch({ type: "send" });
    const host = requireSidebarHost();
    const entity = host.entityId();
    try {
      const receipt = await send({
        name: answers.name,
        email: answers.email,
        company: answers.company,
        topic: answers.topic,
        message: answers.message,
        app: host.app,
        ...(entity ? { entity } : {}),
      });
      dispatch({ type: "sent", replyTo: receipt?.reply_to ?? null });
      notify("Message sent. We'll reply by email.", "success");
    } catch (err) {
      dispatch({ type: "failed", error: sentenceOf(err) });
      return;
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setMenuOpen(false);
    }
  };

  const lines: ContactAction[] = [
    ...actions,
    ...pageActions,
    {
      id: "talk",
      label: "Talk to Minty",
      icon: "chat",
      onSelect: () => setChatOpen(true),
    },
  ];

  const corner = rail ? "right-4 sm:right-6 xl:right-[calc(280px+1.5rem)]" : "right-4 sm:right-6";
  // A cat dragged onto the left half opens its pop-up, chat and tab on the left.
  const left = place !== null && window.innerWidth - place.right - 56 < window.innerWidth / 2;
  // Near the top of the screen the pop-up opens under the cat instead of over it.
  const openBelow = window.innerHeight - (place?.bottom ?? 16) - 112 < 260;

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    drag.current = {
      id: e.pointerId,
      px: e.clientX,
      py: e.clientY,
      ox: e.clientX - box.left,
      oy: e.clientY - box.top,
      w: box.width,
      h: box.height,
      moved: false,
    };
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.px, e.clientY - d.py) < DRAG_PX) return;
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setMenuOpen(false);
    }
    setDragAt({
      x: Math.min(Math.max(e.clientX - d.ox, 0), window.innerWidth - d.w),
      y: Math.min(Math.max(e.clientY - d.oy, 0), window.innerHeight - d.h),
    });
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    justDragged.current = true;
    const x = Math.min(Math.max(e.clientX - d.ox, 0), window.innerWidth - d.w);
    const y = Math.min(Math.max(e.clientY - d.oy, 0), window.innerHeight - d.h);
    // exactly where it was let go - no snapping (owner, 2026-11-09)
    setPlace({
      right: Math.max(0, Math.round(window.innerWidth - (x + d.w))),
      bottom: Math.max(0, Math.round(window.innerHeight - (y + d.h))),
    });
    setDragAt(null);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragAt(null);
  };

  const tuck = (next: boolean) => {
    // brought back, the pop-up opens with it (owner, 2026-11-11) and takes the focus itself
    setMenuOpen(!next);
    setChatOpen(false);
    if (state.step === "sent") dispatch({ type: "reset" });
    focusAfterTuck.current = next;
    setTucked(next);
  };

  // Room at the end of a page that scrolls, for the cat or its tab (see CAT_CLEARANCE and
  // ./pageRoom.ts) - inside the app's scroll wrapper when it has one, or it would add nothing
  // that scrolls.
  const clearance = needsRoom
    ? createPortal(
        <div
          ref={room}
          aria-hidden="true"
          data-minty-cat-clearance=""
          className={`pointer-events-none w-full ${tucked ? TAB_CLEARANCE : CAT_CLEARANCE}`}
        />,
        roomHost(),
      )
    : null;

  if (tucked) {
    return (
      <>
        {clearance}
        <button
          ref={tab}
          type="button"
          aria-label="Bring Minty back"
          title="Bring Minty back"
          onClick={() => tuck(false)}
          style={
            place ? { bottom: `clamp(0px, ${place.bottom}px, calc(100dvh - 3.5rem))` } : undefined
          }
          className={`fixed z-[150] flex h-14 w-11 ${place ? "" : "bottom-[max(1rem,env(safe-area-inset-bottom))]"} cursor-pointer items-center overflow-hidden ${left ? "left-0 justify-start rounded-r-2xl border-l-0" : `${rail ? "right-0 xl:right-[280px]" : "right-0"} justify-end rounded-l-2xl border-r-0`} ${FOCUS_RING} ${look.tab}`}
        >
          {/* The still cat peeking out from the edge. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a packaged component cannot use next/image's loader config */}
          <img
            src={CAT_STILL}
            alt=""
            width={48}
            height={48}
            draggable={false}
            className={`size-12 max-w-none shrink-0 select-none object-contain ${left ? "-translate-x-2" : "translate-x-2"}`}
          />
        </button>
      </>
    );
  }

  return (
    <>
      {clearance}
      <div
        style={dragAt ? { left: dragAt.x, top: dragAt.y } : place ? spotOf(place) : undefined}
        className={`fixed z-[150] ${dragAt || place ? "" : `bottom-[max(1rem,env(safe-area-inset-bottom))] ${corner}`}`}
      >
        {menuOpen ? (
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label="Minty"
            onKeyDown={onMenuKey}
            className={`absolute w-[min(18rem,calc(100vw-2rem))] animate-minty-rise rounded-2xl p-2 motion-reduce:animate-none ${openBelow ? "top-[108px] sm:top-[124px]" : "bottom-[108px] sm:bottom-[124px]"} ${left ? `left-0 ${openBelow ? "origin-top-left" : "origin-bottom-left"}` : `right-0 ${openBelow ? "origin-top-right" : "origin-bottom-right"}`} ${look.popup}`}
          >
            <p className={`pb-1 pl-3 pr-11 pt-2 text-sm font-semibold ${look.popupGreeting}`}>
              Hi! How can I help?
            </p>
            {lines.map((line) => {
              const className = `flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${FOCUS_RING} ${look.popupItem}`;
              const body = (
                <>
                  <span className={look.popupIcon}>
                    {line.icon === "add" ? <AddGlyph /> : <ChatGlyph />}
                  </span>
                  {line.label}
                </>
              );
              return line.href !== undefined ? (
                <a key={line.id} href={line.href} role="menuitem" className={className}>
                  {body}
                </a>
              ) : (
                <button
                  key={line.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    line.onSelect();
                  }}
                  className={className}
                >
                  {body}
                </button>
              );
            })}
            {/* The pop-up's close tucks the cat away (owner, 2026-11-09). Last in the menu, so
                the first line still takes focus on open; drawn top right, beside the greeting. */}
            <button
              type="button"
              role="menuitem"
              aria-label="Tuck Minty away"
              title="Tuck Minty away"
              onClick={() => tuck(true)}
              className={`absolute right-1 top-1 flex size-11 cursor-pointer items-center justify-center rounded-xl ${FOCUS_RING} ${look.close}`}
            >
              <CloseGlyph />
            </button>
            <span
              aria-hidden="true"
              className={`absolute size-3 ${openBelow ? "-top-1.5 rotate-[225deg]" : "-bottom-1.5 rotate-45"} ${left ? "left-[42px] sm:left-[50px]" : "right-[42px] sm:right-[50px]"} ${look.popupTail}`}
            />
          </div>
        ) : null}
        <button
          ref={cat}
          type="button"
          aria-label="Talk to Minty"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={() => {
            if (justDragged.current) {
              justDragged.current = false;
              return;
            }
            if (chatOpen) {
              closeChat();
              return;
            }
            setMenuOpen((open) => !open);
          }}
          className={`group flex size-24 touch-none items-center justify-center rounded-full bg-transparent transition-transform ${dragAt ? "cursor-grabbing" : "cursor-pointer"} duration-150 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 sm:size-28 ${FOCUS_RING} ${look.cat}`}
        >
          {/* The owner's own waving cat (2026-11-05), no button behind it; the shadow follows
              its outline so it stays visible over a busy page. It squishes on a tap and hops
              once when a message is sent (this span). Under reduced motion, the still cat. */}
          <span
            key={state.step === "sent" ? "hop" : "rest"}
            className={`size-full ${state.step === "sent" ? "animate-minty-hop motion-reduce:animate-none" : ""}`}
          >
            <picture>
              <source srcSet={CAT_STILL} media="(prefers-reduced-motion: reduce)" />

              <img
                src={moving ? CAT_ANIMATED : CAT_STILL}
                alt=""
                width={112}
                height={112}
                draggable={false}
                className="size-full select-none object-contain drop-shadow-[0_4px_6px_rgba(17,19,19,0.28)]"
              />
            </picture>
          </span>
        </button>
      </div>
      {chatOpen ? (
        <ContactChat
          state={state}
          dispatch={dispatch}
          suggestions={{
            name: viewer.name || undefined,
            email: viewer.email || loadedEmail || undefined,
            company: requireSidebarHost().entityName() || undefined,
          }}
          name={firstName(viewer.name)}
          look={look}
          rail={rail}
          side={left ? "left" : "right"}
          onClose={closeChat}
          onSend={onSend}
        />
      ) : null}
    </>
  );
}
