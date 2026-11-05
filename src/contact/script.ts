/**
 * The chat's script: a fixed conversation, no AI and no reading of free text. A reducer, so the
 * window only draws what the state says - and a chat bot can later replace this file without
 * touching the window.
 *
 *   main --(Contact Support: a new chat)--> name -> email -> company -> topic -> message
 *        -> review --(Send)--> sending -> sent | failed -> (Try again) sending
 *
 * The owner's shape (2026-11-05): "Talk to Minty" opens on the main topics, listed under Minty's
 * greeting; picking one opens a new chat in it. Contact Support asks one thing at a time - name,
 * email, company, then what they need help with (the topics, as rows in the chat) and the
 * message - each checked as it is typed. At the end, a review of every answer: each can be edited
 * (back to that one question, then straight back to the review) before Send.
 *
 * "Back to topics" (the header's back arrow) goes back to the main topics from anywhere before the send, keeping the answers
 * (they come back as each question's starting text); "Ask something else" starts over after it.
 */

import {
  CONTACT_FIELDS,
  fieldProblem,
  type ContactField,
  type MainTopic,
  type Topic,
} from "./rules";

export type ChatStep = "main" | ContactField | "review" | "sending" | "sent" | "failed";

export type Answers = {
  name: string;
  email: string;
  company: string;
  topic: Topic | null;
  message: string;
};

export type ChatState = {
  step: ChatStep;
  /** The main topic of this chat, or null on the main topics. */
  main: MainTopic | null;
  answers: Answers;
  /** What the composer holds for the question being asked. */
  draft: string;
  /** This question was opened from the review: answering goes straight back to it. */
  editing: boolean;
  /** The composer was left with this draft: an unfinished email now says so. */
  left: boolean;
  /** An answer was refused (empty, too long, not an email): its message now shows. */
  refused: boolean;
  /** Where the reply goes, from the server's answer once sent. */
  replyTo: string | null;
  /** The server's sentence when the send was refused or failed. */
  error: string | null;
};

export type ChatEvent =
  | { type: "pickMain"; main: MainTopic }
  | { type: "type"; draft: string }
  | { type: "leave" }
  /** Answer the question being asked: the draft, or `value` (a suggestion chip). */
  | { type: "answer"; value?: string }
  | { type: "pickTopic"; topic: Topic }
  | { type: "editField"; field: ContactField }
  | { type: "changeTopic" }
  | { type: "send" }
  | { type: "sent"; replyTo: string | null }
  | { type: "failed"; error: string }
  | { type: "reset" };

const EMPTY: Answers = { name: "", email: "", company: "", topic: null, message: "" };

export const START: ChatState = {
  step: "main",
  main: null,
  answers: EMPTY,
  draft: "",
  editing: false,
  left: false,
  refused: false,
  replyTo: null,
  error: null,
};

const isField = (step: ChatStep): step is ContactField =>
  (CONTACT_FIELDS as readonly string[]).includes(step);

/** Ask `field`, its earlier answer as the starting text. */
function ask(state: ChatState, field: ContactField | "review", editing = false): ChatState {
  const draft = field === "review" || field === "topic" ? "" : state.answers[field];
  return { ...state, step: field, draft, editing, left: false, refused: false };
}

/** After `field`: the next question, or the review once everything is in (or when editing). */
function next(state: ChatState, field: ContactField): ChatState {
  if (state.editing) return ask(state, "review");
  const at = CONTACT_FIELDS.indexOf(field);
  return ask(state, CONTACT_FIELDS[at + 1] ?? "review");
}

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "pickMain":
      return state.step === "main" ? ask({ ...state, main: event.main }, "name") : state;
    case "type":
      return { ...state, draft: event.draft };
    case "leave":
      return { ...state, left: true };
    case "answer": {
      const field = state.step;
      if (!isField(field) || field === "topic") return state;
      const value = (event.value ?? state.draft).trim();
      if (fieldProblem(field, value, "submitted"))
        return { ...state, draft: event.value ?? state.draft, refused: true };
      return next({ ...state, answers: { ...state.answers, [field]: value } }, field);
    }
    case "pickTopic":
      return state.step === "topic"
        ? next({ ...state, answers: { ...state.answers, topic: event.topic } }, "topic")
        : state;
    case "editField":
      return state.step === "review" || state.step === "failed"
        ? ask(state, event.field, true)
        : state;
    case "changeTopic":
      return state.step === "main" || state.step === "sending" || state.step === "sent"
        ? state
        : { ...state, step: "main", main: null, editing: false, refused: false, error: null };
    case "send":
      return state.step === "review" || state.step === "failed"
        ? { ...state, step: "sending", error: null }
        : state;
    case "sent":
      return { ...state, step: "sent", replyTo: event.replyTo };
    case "failed":
      return { ...state, step: "failed", error: event.error };
    case "reset":
      return START;
  }
}

/** "Olive" from "Olive Vine"; "" when the name is unknown. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
