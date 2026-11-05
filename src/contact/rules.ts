/**
 * What the "Talk to Minty" chat may send - the same rules Flask's `POST /api/me/contact` applies
 * (`Minty/blueprints/user_management/routes/contact_api.py`), which stays the gate. The topics
 * are minty-www's contact form's five (`minty-www/src/lib/contactRules.ts`); change the three
 * together.
 *
 * Messages follow Part 11: what is wrong, then what to do. Each answer is checked as it is typed
 * (`typing`: only what is wrong at once - a non-English email character, too long), when it is
 * left (`left`: an unfinished email too) and when it is sent (`submitted`: empty too).
 */

import { EMAIL_ASCII_HINT, EMAIL_RE, hasNonAsciiEmailChar } from "../lib/emailInput";

/** What "Talk to Minty" opens on (owner, 2026-11-05) - Contact Support only, until the bot. */
export const MAIN_TOPICS = ["Contact Support"] as const;

export type MainTopic = (typeof MAIN_TOPICS)[number];

/** Contact Support's topics, the rows the chat offers. */
export const TOPICS = [
  "Getting started",
  "Billing & pricing",
  "Technical issue",
  "Xero / integrations",
  "Something else",
] as const;

export type Topic = (typeof TOPICS)[number];

/** What Contact Support asks for, in the order it asks (owner, 2026-11-05). */
export type ContactField = "name" | "email" | "company" | "topic" | "message";

export const CONTACT_FIELDS: readonly ContactField[] = [
  "name",
  "email",
  "company",
  "topic",
  "message",
];

export const FIELD_LABELS: Record<ContactField, string> = {
  name: "Name",
  email: "Email",
  company: "Company",
  topic: "Topic",
  message: "Message",
};

export const MESSAGE_MAX = 5000;
export const NAME_MAX = 100;
export const COMPANY_MAX = 150;
/** Flask's `user.email` width, and its `email_rules.EMAIL_MAX_LENGTH`. */
export const EMAIL_MAX = 150;

const count = (n: number) => n.toLocaleString("en-US");
const tooLong = (subject: string, max: number) =>
  `${subject} is over ${count(max)} characters. Shorten it to ${count(max)} or fewer.`;

export const MESSAGE_EMPTY = "The message is still empty. Tell us how we can help.";
export const MESSAGE_TOO_LONG = tooLong("The message", MESSAGE_MAX);
export const NAME_EMPTY = "Your name is still empty. Add your name to continue.";
export const EMAIL_EMPTY = "The email is still empty. Add your email so we can reply.";
export const EMAIL_INCOMPLETE =
  "This email looks unfinished. Check it reads like name@business.com.";
export const COMPANY_EMPTY = "The company is still empty. Add the company this is about.";
export const TOPIC_EMPTY = "No topic is picked yet. Pick the one closest to your question.";

export type Stage = "typing" | "left" | "submitted";

/** Characters that are markup or quoting, not address - Flask's `email_rules._ADDRESS` refuses them. */
const NOT_ADDRESS = /[\s<>"'`()[\],;:\\]/;

/** The answer's one problem, or null. */
export function fieldProblem(field: ContactField, raw: string, stage: Stage): string | null {
  const value = raw.trim();
  if (field === "topic") {
    return stage === "submitted" && !(TOPICS as readonly string[]).includes(value)
      ? TOPIC_EMPTY
      : null;
  }
  if (!value) {
    if (stage !== "submitted") return null;
    return { name: NAME_EMPTY, email: EMAIL_EMPTY, company: COMPANY_EMPTY, message: MESSAGE_EMPTY }[
      field
    ];
  }
  if (field === "email") {
    if (hasNonAsciiEmailChar(value)) return EMAIL_ASCII_HINT;
    if (stage === "typing") return null;
    return value.length > EMAIL_MAX || !EMAIL_RE.test(value) || NOT_ADDRESS.test(value)
      ? EMAIL_INCOMPLETE
      : null;
  }
  if (field === "name" && value.length > NAME_MAX) return tooLong("Your name", NAME_MAX);
  if (field === "company" && value.length > COMPANY_MAX) return tooLong("The company", COMPANY_MAX);
  if (field === "message" && value.length > MESSAGE_MAX) return MESSAGE_TOO_LONG;
  return null;
}

/** The message's problem - `fieldProblem("message", ...)`, kept for callers that only write it. */
export function messageProblem(raw: string, stage: "typing" | "submitted"): string | null {
  return fieldProblem("message", raw, stage);
}

/** The topic's problem: none picked, once a send was tried. */
export function topicProblem(topic: string | null, stage: "typing" | "submitted"): string | null {
  return fieldProblem("topic", topic ?? "", stage);
}
