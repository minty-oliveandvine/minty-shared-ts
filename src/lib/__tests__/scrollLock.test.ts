// The page lock overlays and the sidebar drawer share (../scrollLock.ts): reference counted, so
// stacked overlays released in any order leave the page scrolling again.

import { afterEach, describe, expect, it } from "vitest";

import { APP_SCROLL_ROOT_ID, pushAppScrollLock } from "../scrollLock";

afterEach(() => {
  document.body.style.overflow = "";
  document.getElementById(APP_SCROLL_ROOT_ID)?.remove();
});

describe("pushAppScrollLock", () => {
  it("locks the body when the app has no scroll root, and lets it go", () => {
    const release = pushAppScrollLock();
    expect(document.body.style.overflow).toBe("hidden");
    release();
    expect(document.body.style.overflow).toBe("");
  });

  it("locks the app's scroll root when there is one", () => {
    const root = document.createElement("div");
    root.id = APP_SCROLL_ROOT_ID;
    root.style.overflow = "auto";
    document.body.appendChild(root);

    const release = pushAppScrollLock();
    expect(root.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("");
    release();
    expect(root.style.overflow).toBe("auto");
  });

  it("holds until the LAST of stacked locks is released, in any order", () => {
    const outer = pushAppScrollLock();
    const inner = pushAppScrollLock();
    outer();
    expect(document.body.style.overflow).toBe("hidden");
    inner();
    expect(document.body.style.overflow).toBe("");
  });

  it("counts a release called twice only once", () => {
    const a = pushAppScrollLock();
    const b = pushAppScrollLock();
    a();
    a();
    expect(document.body.style.overflow).toBe("hidden");
    b();
    expect(document.body.style.overflow).toBe("");
  });
});
