// The "Talk to Minty" cat: its pop-up, the page's extra actions, and the scripted chat that ends in
// the app's `send` - the main topics under Minty's greeting; Contact Support as a new chat asking
// name, email, company, topic (rows in the chat) and message, each checked as typed; then a
// review where any answer can be edited before Send. Each app's own wiring - its fetch to Flask,
// its toast - is tested in that app.

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { installFakeHost, type FakeHost } from "../../../test/fakeHost";
import { _setViewerLoaderForTests } from "../../lib/viewer";
import { SidebarProvider } from "../../sidebar/Sidebar";
import type { Look } from "../../sidebar/looks";
import {
  CONTACT_ASSETS,
  CONTACT_LOOK,
  ContactLauncher,
  MAIN_TOPICS,
  MESSAGE_MAX,
  TOPICS,
  type ContactAction,
  type ContactLauncherProps,
  useContactActions,
} from "../index";
import { _resetContactActionsForTests } from "../actions";

let host: FakeHost;
let send: Mock<ContactLauncherProps["send"]>;
let notify: Mock<ContactLauncherProps["notify"]>;

function show({
  look = "classic",
  actions,
  hidden,
}: { look?: Look; actions?: ContactAction[]; hidden?: boolean } = {}) {
  return render(
    <SidebarProvider look={look}>
      <ContactLauncher send={send} notify={notify} actions={actions} hidden={hidden} />
    </SidebarProvider>,
  );
}

type View = ReturnType<typeof within>;

const cat = () => screen.findByRole("button", { name: "Talk to Minty" });
const chat = () => screen.getByRole("dialog", { name: "Talk to Minty" });

async function openChat() {
  await userEvent.click(await cat());
  await userEvent.click(screen.getByRole("menuitem", { name: "Talk to Minty" }));
  return within(chat());
}

async function openSupport() {
  const view = await openChat();
  await userEvent.click(view.getByRole("button", { name: "Contact Support" }));
  return view;
}

/** Type `value` into the box labelled `label` and send it as the answer. */
async function answer(view: View, label: string, value: string) {
  const box = view.getByLabelText(label);
  await userEvent.clear(box);
  if (value) await userEvent.type(box, value);
  await userEvent.click(view.getByRole("button", { name: /^(Send|Save) answer$/ }));
}

/** Every question answered: the view is at the review. */
async function toReview(message = "My report won't open.") {
  const view = await openSupport();
  await answer(view, "Your name", "Olive Vine");
  await answer(view, "Your email", "olive@test.com");
  await answer(view, "Your company", "Olive Tree Cafe");
  await userEvent.click(view.getByRole("button", { name: "Technical issue" }));
  await answer(view, "Your message", message);
  return view;
}

const reviewValue = (view: View, label: string) => {
  const list = view.getByLabelText("Your answers");
  const term = within(list).getByText(label, { selector: "dt" });
  return term.nextElementSibling?.textContent;
};

beforeEach(() => {
  host = installFakeHost({ app: "minty-web" });
  host.setToken("t1");
  host.setEntity("e-company-a", "Company A Limited");
  _setViewerLoaderForTests(() =>
    Promise.resolve({ name: "Olive Vine", initials: "OV", email: "olive@test.com" }),
  );
  send = vi.fn<ContactLauncherProps["send"]>();
  notify = vi.fn<ContactLauncherProps["notify"]>();
  _resetContactActionsForTests();
});

describe("the cat", () => {
  it("is not drawn for someone signed out", async () => {
    host.setToken("");
    show();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: "Talk to Minty" })).toBeNull();
  });

  it("is not drawn on a page that hides it", async () => {
    show({ hidden: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: "Talk to Minty" })).toBeNull();
  });

  it("shows the still cat at once, the animated one once it has loaded, the still one under reduced motion", async () => {
    // jsdom loads no images: a stand-in Image whose load the test fires by hand
    const preload: { src: string; onload: (() => void) | null } = { src: "", onload: null };
    vi.stubGlobal(
      "Image",
      class {
        set onload(handler: (() => void) | null) {
          preload.onload = handler;
        }
        set src(value: string) {
          preload.src = value;
        }
      },
    );
    show();
    const button = await cat();
    const img = button.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/contact/minty-cat.webp");
    expect(preload.src).toBe("/contact/minty-cat-animated.webp");
    act(() => preload.onload?.());
    expect(img.getAttribute("src")).toBe("/contact/minty-cat-animated.webp");
    vi.unstubAllGlobals();

    const still = button.querySelector("source")!;
    expect(still.getAttribute("srcset")).toBe("/contact/minty-cat.webp");
    expect(still.getAttribute("media")).toBe("(prefers-reduced-motion: reduce)");
    expect([...CONTACT_ASSETS]).toEqual(
      expect.arrayContaining(["/contact/minty-cat.webp", "/contact/minty-cat-animated.webp"]),
    );
  });

  it("opens a pop-up with a greeting and Talk to Minty, which Escape closes back onto the cat", async () => {
    show();
    const button = await cat();
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("animate-minty-rise");
    expect(within(menu).getByText("Hi! How can I help?")).toBeInTheDocument();
    const talk = within(menu).getByRole("menuitem", { name: "Talk to Minty" });
    expect(talk).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("lists the page's actions first, moves between them with the arrows, and runs the one picked", async () => {
    const create = vi.fn();
    show({ actions: [{ id: "create", label: "Create company", icon: "add", onSelect: create }] });
    await userEvent.click(await cat());
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Create company", "Talk to Minty"]);
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(create).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

const CREATE: ContactAction[] = [
  { id: "create", label: "Create company", icon: "add", href: "/entity/create" },
];

function PageWithCreate() {
  useContactActions(CREATE);
  return <p>The entity list</p>;
}

describe("a page's own lines", () => {
  it("appear while the page is mounted, as a link, and go when it unmounts", async () => {
    const view = render(
      <SidebarProvider look="classic">
        <PageWithCreate />
        <ContactLauncher send={send} notify={notify} />
      </SidebarProvider>,
    );
    await userEvent.click(await cat());
    const create = screen.getByRole("menuitem", { name: "Create company" });
    expect(create.tagName).toBe("A");
    expect(create).toHaveAttribute("href", "/entity/create");
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Create company",
      "Talk to Minty",
    ]);

    view.rerender(
      <SidebarProvider look="classic">
        <ContactLauncher send={send} notify={notify} />
      </SidebarProvider>,
    );
    expect(screen.queryByRole("menuitem", { name: "Create company" })).toBeNull();
  });
});

describe("the chat", () => {
  beforeEach(() => {
    show();
  });

  it("lists the main topics as rows right under Minty's greeting, the first one focused", async () => {
    const view = await openChat();
    const log = view.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    const greeting = within(log).getByText("Hi Olive! What can I help you with?");
    const group = within(log).getByRole("group", { name: "Main topics" });
    expect(greeting.nextElementSibling).toBe(group);
    const rows = within(group).getAllByRole("button");
    expect(rows.map((r) => r.textContent?.replace("›", "").trim())).toEqual([...MAIN_TOPICS]);
    expect(rows[0]).toHaveFocus();
    expect(view.queryByRole("button", { name: "Change topic" })).toBeNull();
  });

  it("opens Contact Support as a new chat that asks for the name first", async () => {
    const view = await openSupport();
    expect(view.queryByText("Hi Olive! What can I help you with?")).toBeNull();
    expect(view.getByText("Contact Support", { selector: "header p" })).toBeInTheDocument();
    expect(view.getByText("First, what's your name?")).toBeInTheDocument();
    expect(view.getByLabelText("Your name")).toHaveFocus();
    // the app knows the name: one tap answers it
    expect(view.getByRole("button", { name: "Olive Vine" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Change topic" })).toBeInTheDocument();
  });

  it("asks name, email, company, topic and message in turn, then reviews and sends them", async () => {
    send.mockResolvedValue({ reply_to: "olive@test.com" });
    const view = await openSupport();

    await userEvent.click(view.getByRole("button", { name: "Olive Vine" }));
    expect(view.getByText("Thanks, Olive! What email should we reply to?")).toBeInTheDocument();
    expect(view.getByLabelText("Your email")).toHaveFocus();
    // the account's email is a one-tap answer, as the name was
    await userEvent.click(view.getByRole("button", { name: "olive@test.com" }));

    expect(view.getByText("Which company is this about?")).toBeInTheDocument();
    await userEvent.click(view.getByRole("button", { name: "Company A Limited" }));

    expect(view.getByText("What do you need help with?")).toBeInTheDocument();
    const topics = within(view.getByRole("log")).getByRole("group", { name: "Topics" });
    const rows = within(topics).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual([...TOPICS]);
    expect(topics).toHaveClass("grid-cols-2");
    expect(rows[0]).toHaveFocus();
    await userEvent.click(within(topics).getByRole("button", { name: "Technical issue" }));

    expect(view.getByText("Tell me a little more. What's happening?")).toBeInTheDocument();
    await answer(view, "Your message", "My report won't open.");

    expect(
      view.getByText("Here's what I'll send. Change anything before it goes."),
    ).toBeInTheDocument();
    expect(reviewValue(view, "Name")).toBe("Olive Vine");
    expect(reviewValue(view, "Email")).toBe("olive@test.com");
    expect(reviewValue(view, "Company")).toBe("Company A Limited");
    expect(reviewValue(view, "Topic")).toBe("Technical issue");
    expect(reviewValue(view, "Message")).toBe("My report won't open.");
    const sendButton = view.getByRole("button", { name: "Send" });
    expect(sendButton).toHaveFocus();
    expect(send).not.toHaveBeenCalled();

    await userEvent.click(sendButton);
    expect(send).toHaveBeenCalledWith({
      name: "Olive Vine",
      email: "olive@test.com",
      company: "Company A Limited",
      topic: "Technical issue",
      message: "My report won't open.",
      app: "minty-web",
      entity: "e-company-a",
    });
    expect(
      await view.findByText(/Sent! We'll reply to olive@test.com, usually within one business day/),
    ).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith("Message sent. We'll reply by email.", "success");
    expect(view.getByRole("button", { name: "Ask something else" })).toHaveFocus();
    expect(view.queryByRole("button", { name: /^Edit / })).toBeNull();
  });

  it("checks the email as it is typed, when it is left, and when it is sent", async () => {
    const view = await openSupport();
    await answer(view, "Your name", "Olive Vine");
    const box = view.getByLabelText("Your email");

    // a non-English character: dropped at once, and the hint says why
    await userEvent.type(box, "올리브");
    expect(box).toHaveValue("");
    expect(
      view.getByText("Email can only contain English letters, numbers and symbols."),
    ).toBeInTheDocument();

    // half typed: nothing yet while typing, "unfinished" once the box is left
    await userEvent.type(box, "olive@");
    expect(view.queryByText(/looks unfinished/)).toBeNull();
    await userEvent.tab();
    expect(
      view.getByText("This email looks unfinished. Check it reads like name@business.com."),
    ).toBeInTheDocument();
    expect(box).toHaveAttribute("aria-invalid", "true");

    // refused on send, and the question stays
    await userEvent.click(view.getByRole("button", { name: "Send answer" }));
    expect(view.getByText(/looks unfinished/)).toBeInTheDocument();
    expect(view.getByLabelText("Your email")).toBeInTheDocument();

    // markup is not an address either (Flask's rule)
    await answer(view, "Your email", "<svg>@x.co");
    expect(view.getByText(/looks unfinished/)).toBeInTheDocument();

    await answer(view, "Your email", "olive@test.com");
    expect(view.getByText("Which company is this about?")).toBeInTheDocument();
  });

  it("refuses an empty answer with its sentence, and says at once when one is too long", async () => {
    const view = await openSupport();
    await userEvent.click(view.getByRole("button", { name: "Send answer" }));
    expect(
      view.getByText("Your name is still empty. Add your name to continue."),
    ).toBeInTheDocument();
    expect(view.getByLabelText("Your name")).toHaveFocus();

    await answer(view, "Your name", "Olive Vine");
    await answer(view, "Your email", "olive@test.com");
    await userEvent.click(view.getByLabelText("Your company"));
    await userEvent.paste("x".repeat(151));
    expect(
      view.getByText("The company is over 150 characters. Shorten it to 150 or fewer."),
    ).toBeInTheDocument();

    await answer(view, "Your company", "Olive Tree Cafe");
    await userEvent.click(view.getByRole("button", { name: "Something else" }));
    await userEvent.click(view.getByLabelText("Your message"));
    await userEvent.paste("x".repeat(MESSAGE_MAX + 1));
    expect(
      view.getByText("The message is over 5,000 characters. Shorten it to 5,000 or fewer."),
    ).toBeInTheDocument();
    expect(view.getByText("5,001 / 5,000")).toBeInTheDocument();
  });

  it("lets any answer be edited from the review, then comes straight back to it", async () => {
    const view = await toReview();

    await userEvent.click(view.getByRole("button", { name: "Edit email" }));
    expect(view.getByText("Sure. What should the email be?")).toBeInTheDocument();
    const box = view.getByLabelText("Your email");
    expect(box).toHaveValue("olive@test.com");
    expect(box).toHaveFocus();
    await answer(view, "Your email", "help@olivetree.test");
    expect(reviewValue(view, "Email")).toBe("help@olivetree.test");

    await userEvent.click(view.getByRole("button", { name: "Edit topic" }));
    expect(view.getByText("Sure. Which topic fits best?")).toBeInTheDocument();
    await userEvent.click(view.getByRole("button", { name: "Billing & pricing" }));
    expect(reviewValue(view, "Topic")).toBe("Billing & pricing");

    await userEvent.click(view.getByRole("button", { name: "Edit message" }));
    await answer(view, "Your message", "It's the invoice.");
    expect(reviewValue(view, "Message")).toBe("It's the invoice.");
    expect(view.getByRole("button", { name: "Send" })).toHaveFocus();
  });

  it("sends no company id when the page has none", async () => {
    host.setEntity("");
    send.mockResolvedValue({});
    const view = await toReview();
    await userEvent.click(view.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0]).not.toHaveProperty("entity");
  });

  it("Change topic goes back to the main topics, and Contact Support picks up the answers again", async () => {
    const view = await openSupport();
    await answer(view, "Your name", "Olive Vine");
    await userEvent.type(view.getByLabelText("Your email"), "half@");

    await userEvent.click(view.getByRole("button", { name: "Change topic" }));
    const main = within(view.getByRole("group", { name: "Main topics" })).getAllByRole("button");
    expect(main[0]).toHaveFocus();
    expect(view.getByText("Hi Olive! What can I help you with?")).toBeInTheDocument();

    await userEvent.click(main[0]);
    expect(view.getByLabelText("Your name")).toHaveValue("Olive Vine");
  });

  it("starts over in place after a send, with Ask something else", async () => {
    send.mockResolvedValue({ reply_to: "olive@test.com" });
    const view = await toReview("First question");
    await userEvent.click(view.getByRole("button", { name: "Send" }));
    await userEvent.click(await view.findByRole("button", { name: "Ask something else" }));
    expect(view.queryByText("First question")).toBeNull();
    const main = within(view.getByRole("group", { name: "Main topics" })).getAllByRole("button");
    expect(main[0]).toHaveFocus();
  });

  it("shows a refusal as Minty's line with Try again - the answers still editable - and sends again", async () => {
    send.mockRejectedValueOnce(
      new Error("That's a lot of messages in one hour. Try again later, or email us."),
    );
    send.mockResolvedValueOnce({ reply_to: "olive@test.com" });
    const view = await toReview();
    await userEvent.click(view.getByRole("button", { name: "Send" }));

    expect(
      await view.findByText("That's a lot of messages in one hour. Try again later, or email us."),
    ).toBeInTheDocument();
    const retry = view.getByRole("button", { name: "Try again" });
    expect(retry).toHaveFocus();
    expect(view.getByRole("button", { name: "Edit email" })).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();

    await userEvent.click(retry);
    expect(await view.findByText(/Sent!/)).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("takes the sentence from a plain { message } refusal too", async () => {
    send.mockRejectedValue({ status: 403, message: "You don't have access to that company." });
    const view = await toReview();
    await userEvent.click(view.getByRole("button", { name: "Send" }));
    expect(await view.findByText("You don't have access to that company.")).toBeInTheDocument();
  });

  it("falls back to its own sentence when the error has none", async () => {
    send.mockRejectedValue(new Error(""));
    const view = await toReview();
    await userEvent.click(view.getByRole("button", { name: "Send" }));
    expect(
      await view.findByText("We couldn't send your message just now. Try again in a moment."),
    ).toBeInTheDocument();
  });

  it("keeps the conversation through a close, and starts fresh after a send", async () => {
    send.mockResolvedValue({ reply_to: "olive@test.com" });
    let view = await toReview("Keep me");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await cat()).toHaveFocus();

    view = await openChat();
    expect(reviewValue(view, "Message")).toBe("Keep me");
    await userEvent.click(view.getByRole("button", { name: "Send" }));
    await view.findByText(/Sent!/);
    await userEvent.click(view.getByRole("button", { name: "Close" }));

    view = await openChat();
    expect(view.queryByText("Keep me")).toBeNull();
    expect(view.getByRole("group", { name: "Main topics" })).toBeInTheDocument();
  });

  it("moves, unless motion is reduced: the window rises, lines pop in, the cat hops when sent", async () => {
    send.mockResolvedValue({ reply_to: "olive@test.com" });
    const view = await toReview();
    expect(chat()).toHaveClass("animate-minty-rise", "motion-reduce:animate-none");
    expect(view.getByText("First, what's your name?")).toHaveClass(
      "animate-minty-pop",
      "motion-reduce:animate-none",
    );
    await userEvent.click(view.getByRole("button", { name: "Send" }));
    await view.findByText(/Sent!/);
    const hop = (await cat()).querySelector("span")!;
    expect(hop).toHaveClass("animate-minty-hop", "motion-reduce:animate-none");
  });
});

describe("without the viewer's email", () => {
  // like the company: offered only when the app knows it (onboarding's hand-off carries none)
  it("offers no email to tap when the app does not know it", async () => {
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    show();
    const view = await openSupport();
    await answer(view, "Your name", "Olive Vine");
    expect(view.getByLabelText("Your email")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: /@/ })).toBeNull();
  });

  it("asks the app's loadEmail once Contact Support opens - never before - and offers its answer", async () => {
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    const loadEmail = vi.fn(() => Promise.resolve("olive@wizard.test"));
    render(
      <SidebarProvider look="classic">
        <ContactLauncher send={send} notify={notify} loadEmail={loadEmail} />
      </SidebarProvider>,
    );
    const view = await openChat();
    expect(loadEmail).not.toHaveBeenCalled();

    await userEvent.click(view.getByRole("button", { name: "Contact Support" }));
    await answer(view, "Your name", "Olive Vine");
    expect(await view.findByRole("button", { name: "olive@wizard.test" })).toBeInTheDocument();

    // once a page: a second Contact Support asks nothing new
    await userEvent.click(view.getByRole("button", { name: "Change topic" }));
    await userEvent.click(view.getByRole("button", { name: "Contact Support" }));
    expect(loadEmail).toHaveBeenCalledTimes(1);
  });

  it("offers nothing, and says so on the console, when loadEmail fails", async () => {
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const loadEmail = vi.fn(() => Promise.reject(new Error("offline")));
    render(
      <SidebarProvider look="classic">
        <ContactLauncher send={send} notify={notify} loadEmail={loadEmail} />
      </SidebarProvider>,
    );
    const view = await openSupport();
    await answer(view, "Your name", "Olive Vine");
    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(view.queryByRole("button", { name: /@/ })).toBeNull();
    expect(view.getByLabelText("Your email")).toBeInTheDocument();
  });

  it("does not call loadEmail when the viewer already has one", async () => {
    const loadEmail = vi.fn(() => Promise.resolve("other@x.test"));
    render(
      <SidebarProvider look="classic">
        <ContactLauncher send={send} notify={notify} loadEmail={loadEmail} />
      </SidebarProvider>,
    );
    await openSupport();
    expect(loadEmail).not.toHaveBeenCalled();
  });
});

describe.each<Look>(["classic", "v2"])("the %s look", (look) => {
  it("dresses the cat, the pop-up and the chat in its own classes", async () => {
    show({ look });
    const button = await cat();
    expect(button.className).toContain(CONTACT_LOOK[look].cat);
    await userEvent.click(button);
    expect(screen.getByRole("menu").className).toContain(CONTACT_LOOK[look].popup);
    await userEvent.click(screen.getByRole("menuitem", { name: "Talk to Minty" }));
    expect(chat().className).toContain(CONTACT_LOOK[look].window);
  });
});
