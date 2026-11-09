"use client";

/**
 * Whether the page needs room at its end for the cat (v0.15): only when the page itself scrolls -
 * its content is taller than the screen - so its last controls can scroll up clear of the cat. A
 * page that fits the screen gets none: there the block would only add a band of the body's
 * background and a scroll to nowhere (minty-web's company list is one screen tall and scrolls
 * inside itself). Where the cat covers something on such a page, the pop-up's close tucks it.
 *
 * The scroller is `#app-scroll-root` when the app has one AND it is the element scrolling (an
 * app may scroll it only below some width - minty-payment-request-web below 1280px), else the
 * document. Re-measured whenever the page's top-level content changes size or the window does.
 */

import { useEffect, useState, type RefObject } from "react";

import { APP_SCROLL_ROOT_ID } from "../lib/scrollLock";

/** Where the room goes: the app's scroll wrapper when it has one, else `body`. */
export function roomHost(): HTMLElement {
  return document.getElementById(APP_SCROLL_ROOT_ID) ?? document.body;
}

function scrolls(el: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(el);
  return overflowY === "auto" || overflowY === "scroll";
}

/** True when the page's own content (the room left out) is taller than what is on screen. */
export function pageOverflows(room: HTMLElement | null): boolean {
  const wrapper = document.getElementById(APP_SCROLL_ROOT_ID);
  const own = room?.offsetHeight ?? 0;
  if (wrapper && scrolls(wrapper)) {
    return wrapper.scrollHeight - own > wrapper.clientHeight + 1;
  }
  return document.documentElement.scrollHeight - own > window.innerHeight + 1;
}

export function usePageNeedsRoom(enabled: boolean, room: RefObject<HTMLElement | null>): boolean {
  const [needs, setNeeds] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const host = roomHost();
    const measure = () => setNeeds(pageOverflows(room.current));

    if (typeof ResizeObserver === "undefined") {
      const frame = requestAnimationFrame(measure);
      window.addEventListener("resize", measure);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", measure);
      };
    }

    // Watch the page's top-level content (never the room itself): any change in its height may
    // start or stop the page scrolling. An observed element is measured once when watched.
    const sizes = new ResizeObserver(measure);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(host);
      for (const child of Array.from(host.children)) {
        if (child !== room.current) sizes.observe(child);
      }
    };
    watch();
    const children = new MutationObserver(watch);
    children.observe(host, { childList: true });
    window.addEventListener("resize", measure);
    return () => {
      sizes.disconnect();
      children.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, room]);

  return enabled && needs;
}
