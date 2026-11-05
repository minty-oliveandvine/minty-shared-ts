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
 */

import { useEffect, useId, useReducer, useRef, useState, type KeyboardEvent } from "react";

import { requireSidebarHost } from "../host";
import { useViewer } from "../lib/viewer";
import { useLook, useSidebar } from "../sidebar/Sidebar";
import { useRegisteredContactActions, type ContactAction } from "./actions";
import { ContactChat } from "./ContactChat";
import { AddGlyph, ChatGlyph, MintyAvatar } from "./glyphs";
import { CONTACT_LOOK } from "./looks";
import type { Topic } from "./rules";
import { START, chatReducer, firstName } from "./script";

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
  const [state, dispatch] = useReducer(chatReducer, START);
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
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

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

  return (
    <>
      <div className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-[150] ${corner}`}>
        {menuOpen ? (
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label="Minty"
            onKeyDown={onMenuKey}
            className={`absolute bottom-[108px] right-0 w-[min(18rem,calc(100vw-2rem))] origin-bottom-right animate-minty-rise rounded-2xl p-2 motion-reduce:animate-none sm:bottom-[124px] ${look.popup}`}
          >
            <p className={`px-3 pb-1 pt-2 text-sm font-semibold ${look.popupGreeting}`}>
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
            <span
              aria-hidden="true"
              className={`absolute -bottom-1.5 right-[42px] size-3 rotate-45 sm:right-[50px] ${look.popupTail}`}
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
          onClick={() => {
            if (chatOpen) {
              closeChat();
              return;
            }
            setMenuOpen((open) => !open);
          }}
          className={`group flex size-24 cursor-pointer items-center justify-center rounded-full bg-transparent transition-transform duration-150 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100 sm:size-28 ${FOCUS_RING} ${look.cat}`}
        >
          {/* The cat alone, no button behind it, and large (owner, 2026-11-05); the shadow follows
              its outline so it stays visible over a busy page. It squishes on a tap, and hops
              once when a message is sent (the outer span; the cat bobs inside it). */}
          <span
            key={state.step === "sent" ? "hop" : "rest"}
            className={`size-full ${state.step === "sent" ? "animate-minty-hop motion-reduce:animate-none" : ""}`}
          >
            <MintyAvatar
              size={112}
              className="size-full animate-minty-bob drop-shadow-[0_4px_6px_rgba(17,19,19,0.28)] group-hover:animate-minty-wave group-focus-visible:animate-minty-wave motion-reduce:animate-none"
            />
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
          onClose={closeChat}
          onSend={onSend}
        />
      ) : null}
    </>
  );
}
