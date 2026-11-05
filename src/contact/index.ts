/**
 * The "Talk to Minty" cat and chat (v0.14): a pop-up on the cat at the bottom right, and a scripted
 * chat that emails the team through the app's own `send`. An app imports from here, never from
 * the files.
 */

export {
  ContactLauncher,
  type ContactLauncherProps,
  type ContactMessage,
  type ContactReceipt,
} from "./ContactLauncher";
export { useContactActions, type ContactAction } from "./actions";
export { CONTACT_ASSETS } from "./assets";
export { CONTACT_LOOK, type ContactLookClasses } from "./looks";
export {
  CONTACT_FIELDS,
  FIELD_LABELS,
  MAIN_TOPICS,
  MESSAGE_MAX,
  TOPICS,
  fieldProblem,
  messageProblem,
  topicProblem,
  type ContactField,
  type MainTopic,
  type Topic,
} from "./rules";
