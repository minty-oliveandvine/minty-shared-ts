"use client";

/**
 * The "Talk to Minty" chat window (`./script.ts` decides what is shown). A full-screen sheet on a
 * phone; from `sm` a 380px panel docked above the cat.
 *
 * The owner's shape (2026-11-05): the main topics as rows under Minty's greeting; picking one
 * opens a new chat in it. Contact Support asks one question at a time - name, email, company,
 * then the topics (rows in the conversation) and the message - each answer checked as it is
 * typed, the email most of all. Then a review: every answer with its own Edit, and Send. The
 * composer sits at the bottom, with "Ask something else" after a send. The header's back arrow
 * (owner, 2026-11-05 - it was a "Change topic" button at the bottom) goes back to the main
 * topics from anywhere in a topic's chat before the send, keeping the answers.
 *
 * Non-modal, like any chat: the page stays usable beside it on a computer. Focus moves to what the
 * step asks for, so a keyboard or screen-reader user is always at the question; Escape closes and
 * the launcher gives the focus back to the cat. The conversation is a polite live region.
 *
 * Motion: the window rises out of the cat, each new line pops in, rows lift on hover and press
 * in, the typing dots bounce. None of it under reduced motion (`POP`, `PRESS`, `DOT`).
 */

import { Fragment, useEffect, useId, useRef, type Dispatch, type ReactNode } from "react";

import { EMAIL_ASCII_HINT, useEmailInput } from "../lib/emailInput";
import { BackGlyph, CloseGlyph, MintyAvatar, SendGlyph } from "./glyphs";
import type { ContactLookClasses } from "./looks";
import {
  CONTACT_FIELDS,
  FIELD_LABELS,
  MAIN_TOPICS,
  MESSAGE_MAX,
  TOPICS,
  fieldProblem,
  type ContactField,
} from "./rules";
import { firstName, type ChatEvent, type ChatState } from "./script";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2";
/** A new line or control popping in. */
const POP = "animate-minty-pop motion-reduce:animate-none";
/** The typing dots: a gentle bounce, or still. */
const DOT = "animate-minty-dot motion-reduce:animate-none";
/** Lift on hover, press in on a tap. */
const PRESS =
  "transition-[transform,background-color,border-color] duration-150 hover:-translate-y-px active:translate-y-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100";

/** What Minty asks for each answer - and, from the review, when it is being changed. */
function question(field: ContactField, state: ChatState): string {
  if (state.editing) {
    return field === "topic"
      ? "Sure. Which topic fits best?"
      : `Sure. What should the ${FIELD_LABELS[field].toLowerCase()} be?`;
  }
  switch (field) {
    case "name":
      return "First, what's your name?";
    case "email": {
      const first = firstName(state.answers.name);
      return `Thanks${first ? `, ${first}` : ""}! What email should we reply to?`;
    }
    case "company":
      return "Which company is this about?";
    case "topic":
      return "What do you need help with?";
    case "message":
      return "Tell me a little more. What's happening?";
  }
}

const COMPOSER_LABEL: Record<Exclude<ContactField, "topic">, string> = {
  name: "Your name",
  email: "Your email",
  company: "Your company",
  message: "Your message",
};

export function ContactChat({
  state,
  dispatch,
  name,
  suggestions,
  look,
  rail,
  onClose,
  onSend,
}: {
  state: ChatState;
  dispatch: Dispatch<ChatEvent>;
  /** The viewer's first name, or "" when unknown. */
  name: string;
  /** One-tap answers the app already knows: the viewer's name and email, the company it is in. */
  suggestions: { name?: string; email?: string; company?: string };
  look: ContactLookClasses;
  /** The sidebar stands as a 280px rail from 1280px: dock left of it. */
  rail: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  const titleId = useId();
  const composerId = useId();
  const problemId = useId();
  const firstMain = useRef<HTMLButtonElement>(null);
  const firstTopic = useRef<HTMLButtonElement>(null);
  const composer = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const askElse = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const email = useEmailInput((value) => dispatch({ type: "type", draft: value }));

  const step = state.step;
  const asking = step === "name" || step === "email" || step === "company" || step === "message";
  const stage = state.refused ? "submitted" : state.left ? "left" : "typing";
  // The email box drops a non-English character as it is typed, so its hint comes from the strip.
  const problem = !asking
    ? null
    : step === "email" && email.rejected
      ? EMAIL_ASCII_HINT
      : fieldProblem(step, state.draft, stage);
  const done = step === "review" || step === "sending" || step === "sent" || step === "failed";

  // Focus follows the question being asked.
  useEffect(() => {
    if (step === "main") firstMain.current?.focus();
    else if (step === "topic") firstTopic.current?.focus();
    else if (asking) composer.current?.focus();
    else if (step === "review") sendButton.current?.focus();
    else if (step === "failed") retryButton.current?.focus();
    else if (step === "sent") askElse.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a new question only
  }, [step, state.editing]);

  // The newest line in view.
  useEffect(() => {
    const el = log.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight });
  }, [step, state.editing]);

  const minty = `max-w-[85%] origin-bottom-left self-start rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-5 ${POP} ${look.minty}`;
  const me = `max-w-[85%] origin-bottom-right self-end whitespace-pre-wrap break-words rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm leading-5 ${POP} ${look.me}`;
  const button = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${FOCUS_RING} ${PRESS}`;
  const row = `flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2 text-left text-sm font-medium ${FOCUS_RING} ${PRESS} ${look.row}`;
  const chip = `min-h-11 cursor-pointer rounded-xl px-3.5 text-sm font-medium ${FOCUS_RING} ${PRESS} ${look.chip}`;
  const footerButton = `min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold ${FOCUS_RING} ${PRESS} ${look.footerAction}`;

  // The questions already answered, each with its answer - all of them once the review is
  // reached or one answer is being changed from it.
  const at = CONTACT_FIELDS.indexOf(step as ContactField);
  const answered = CONTACT_FIELDS.filter((field, i) =>
    done || state.editing ? Boolean(state.answers[field]) : at > i,
  );
  const shown = (field: ContactField) => state.answers[field] ?? "";

  let transcript: ReactNode;
  if (step === "main") {
    transcript = (
      <>
        <p className={minty}>{name ? `Hi ${name}! ` : "Hi! "}What can I help you with?</p>
        <div className={`flex flex-col gap-1.5 ${POP}`} role="group" aria-label="Main topics">
          {MAIN_TOPICS.map((main, i) => (
            <button
              key={main}
              ref={i === 0 ? firstMain : undefined}
              type="button"
              onClick={() => dispatch({ type: "pickMain", main })}
              className={row}
            >
              <span className="min-w-0 flex-1">{main}</span>
              <span aria-hidden="true" className={`text-lg leading-none ${look.rowMark}`}>
                ›
              </span>
            </button>
          ))}
        </div>
      </>
    );
  } else {
    transcript = (
      <>
        <p className={minty}>{state.main}. I&apos;ll take a few details so the team can reply.</p>
        {answered.map((field) => (
          <Fragment key={field}>
            <p className={minty}>{question(field, { ...state, editing: false })}</p>
            <p className={me}>{shown(field)}</p>
          </Fragment>
        ))}
        {!done ? <p className={minty}>{question(step as ContactField, state)}</p> : null}
        {step === "topic" ? (
          <div className={`grid grid-cols-2 gap-1.5 ${POP}`} role="group" aria-label="Topics">
            {TOPICS.map((topic, i) => (
              <button
                key={topic}
                ref={i === 0 ? firstTopic : undefined}
                type="button"
                aria-pressed={state.answers.topic === topic}
                onClick={() => dispatch({ type: "pickTopic", topic })}
                className={`${row} ${state.answers.topic === topic ? look.rowSelected : ""}`}
              >
                {topic}
              </button>
            ))}
          </div>
        ) : null}
        {done ? (
          <>
            <p className={minty}>
              Here&apos;s what I&apos;ll send. Change anything before it goes.
            </p>
            <dl
              aria-label="Your answers"
              className={`flex flex-col gap-0.5 rounded-xl p-1.5 ${POP} ${look.review}`}
            >
              {CONTACT_FIELDS.map((field) => (
                <div key={field} className="flex items-start gap-2 px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <dt className={`text-xs leading-4 ${look.label}`}>{FIELD_LABELS[field]}</dt>
                    <dd
                      className={`mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 ${look.title}`}
                    >
                      {shown(field)}
                    </dd>
                  </div>
                  {step === "review" || step === "failed" ? (
                    <button
                      type="button"
                      aria-label={`Edit ${FIELD_LABELS[field].toLowerCase()}`}
                      onClick={() => dispatch({ type: "editField", field })}
                      className={`-my-1 min-h-11 shrink-0 cursor-pointer rounded-xl px-3 text-sm font-semibold ${FOCUS_RING} ${PRESS} ${look.footerAction}`}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              ))}
            </dl>
          </>
        ) : null}
        {step === "review" ? (
          <button
            ref={sendButton}
            type="button"
            onClick={onSend}
            className={`${button} self-stretch ${POP} ${look.primary}`}
          >
            Send
          </button>
        ) : null}
        {step === "sending" ? (
          <p className={`${minty} inline-flex items-center gap-1`} aria-label="Minty is sending">
            <span className={`size-1.5 rounded-full ${DOT} ${look.dot}`} />
            <span className={`size-1.5 rounded-full [animation-delay:150ms] ${DOT} ${look.dot}`} />
            <span className={`size-1.5 rounded-full [animation-delay:300ms] ${DOT} ${look.dot}`} />
          </p>
        ) : null}
        {step === "sent" ? (
          <p className={minty}>
            Sent! We&apos;ll reply to {state.replyTo ?? state.answers.email}, usually within one
            business day.
          </p>
        ) : null}
        {step === "failed" ? (
          <>
            <p className={minty}>{state.error}</p>
            <button
              ref={retryButton}
              type="button"
              onClick={onSend}
              className={`${button} self-stretch ${POP} ${look.primary}`}
            >
              Try again
            </button>
          </>
        ) : null}
      </>
    );
  }

  const suggestion =
    step === "name" || step === "email" || step === "company" ? suggestions[step] : undefined;
  const inputClass = `min-h-11 min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm leading-5 outline-none ${look.field} ${problem ? look.fieldInvalid : ""}`;
  const describe = {
    "aria-required": true,
    "aria-invalid": problem ? true : undefined,
    "aria-describedby": problem ? problemId : undefined,
  } as const;

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`fixed inset-0 z-[160] flex min-w-0 flex-col sm:inset-auto sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+128px)] sm:right-6 sm:h-[min(640px,calc(100dvh-160px))] sm:w-[380px] sm:origin-bottom-right sm:overflow-hidden sm:rounded-2xl animate-minty-rise motion-reduce:animate-none ${rail ? "xl:right-[calc(280px+1.5rem)]" : ""} ${look.window}`}
    >
      <header
        className={`flex shrink-0 items-center gap-3 px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] sm:pt-3 ${look.header}`}
      >
        {step !== "main" && step !== "sending" && step !== "sent" ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "changeTopic" })}
            aria-label="Back to topics"
            className={`-ml-2 -mr-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl ${FOCUS_RING} ${PRESS} ${look.close}`}
          >
            <BackGlyph />
          </button>
        ) : null}
        <MintyAvatar size={40} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className={`text-base font-semibold leading-6 ${look.title}`}>
            Talk to Minty
          </h2>
          <p className={`text-xs leading-4 ${look.subtitle}`}>
            {state.main ?? "We reply by email"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`-mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl ${FOCUS_RING} ${look.close}`}
        >
          <CloseGlyph />
        </button>
      </header>

      {/* A new chat per main topic: keyed, so the conversation starts afresh. */}
      <div
        key={state.main ?? "main"}
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversation with Minty"
        className="flex min-h-24 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      >
        {transcript}
      </div>

      {!asking && step !== "sent" ? null : (
        <div
          className={`flex shrink-0 flex-col gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:pb-3 ${look.composer}`}
        >
          {asking ? (
            <form
              key={`${step}-${state.editing}`}
              className={POP}
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: "answer" });
                composer.current?.focus();
              }}
            >
              {suggestion && suggestion !== state.draft.trim() ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "answer", value: suggestion })}
                  className={`${chip} mb-2`}
                >
                  {suggestion}
                </button>
              ) : null}
              <label
                htmlFor={composerId}
                className={`mb-1 block text-xs font-medium ${look.label}`}
              >
                {COMPOSER_LABEL[step]}
              </label>
              <div className="flex items-end gap-2">
                {step === "message" ? (
                  <textarea
                    ref={composer}
                    id={composerId}
                    rows={3}
                    value={state.draft}
                    {...describe}
                    onChange={(e) => dispatch({ type: "type", draft: e.target.value })}
                    onBlur={() => dispatch({ type: "leave" })}
                    className={`${inputClass} resize-none`}
                  />
                ) : (
                  <input
                    ref={composer}
                    id={composerId}
                    type="text"
                    value={state.draft}
                    autoComplete={
                      step === "name" ? "name" : step === "company" ? "organization" : undefined
                    }
                    {...describe}
                    onChange={(e) => dispatch({ type: "type", draft: e.target.value })}
                    {...(step === "email" ? email.props : {})}
                    onBlur={() => dispatch({ type: "leave" })}
                    className={inputClass}
                  />
                )}
                <button
                  type="submit"
                  aria-label={state.editing ? "Save answer" : "Send answer"}
                  className={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl ${FOCUS_RING} ${PRESS} ${look.primary}`}
                >
                  <SendGlyph />
                </button>
              </div>
              <div className="mt-1 flex items-start justify-between gap-3">
                <p id={problemId} className={`min-w-0 text-xs leading-4 ${look.problem}`}>
                  {problem}
                </p>
                {step === "message" ? (
                  <p className={`shrink-0 text-xs leading-4 ${look.counter}`}>
                    {state.draft.trim().length.toLocaleString("en-US")} /{" "}
                    {MESSAGE_MAX.toLocaleString("en-US")}
                  </p>
                ) : null}
              </div>
            </form>
          ) : null}

          {step === "sent" ? (
            <div className="flex">
              <button
                ref={askElse}
                type="button"
                onClick={() => dispatch({ type: "reset" })}
                className={footerButton}
              >
                Ask something else
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
