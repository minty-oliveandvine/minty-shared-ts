// A browser-only value read from a component that also renders on the server
// (lib/clientValue.ts). Ported from minty-payment-request-web's useClientValue.test.tsx and
// minty-onboarding-web's useMounted.test.tsx: the server snapshot on the server (the browser read
// never called there), the client's value in the browser, and nothing subscribes.

import { act, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useMounted as sidebarUseMounted } from "../../sidebar";
import { useClientValue, useMounted } from "../clientValue";

function Probe({ read, server }: { read: () => string; server: () => string }) {
  return <p role="status">{useClientValue(read, server)}</p>;
}

const neutral = () => "neutral";

describe("useClientValue", () => {
  it("renders the server snapshot on the server, and never calls the browser read there", () => {
    let calls = 0;
    const read = () => {
      calls += 1;
      return "from the browser";
    };
    const html = renderToString(<Probe read={read} server={neutral} />);
    expect(html).toContain("neutral");
    expect(html).not.toContain("from the browser");
    expect(calls).toBe(0);
  });

  it("renders the browser's value on a client render", () => {
    render(<Probe read={() => "from the browser"} server={neutral} />);
    expect(screen.getByRole("status").textContent).toBe("from the browser");
  });

  it("does not notice a change by itself - nothing subscribes", () => {
    let value = "first";
    const read = () => value;
    const { rerender } = render(<Probe read={read} server={neutral} />);
    act(() => {
      value = "second";
    });
    expect(screen.getByRole("status").textContent).toBe("first");
    rerender(<Probe read={read} server={neutral} />);
    expect(screen.getByRole("status").textContent).toBe("second");
  });
});

describe("useMounted", () => {
  function Where() {
    return <span>{useMounted() ? "client" : "server"}</span>;
  }

  it("is false in a server render and true in the browser, across re-renders", () => {
    expect(renderToString(<Where />)).toBe("<span>server</span>");
    const { result, rerender } = renderHook(() => useMounted());
    expect(result.current).toBe(true);
    rerender();
    expect(result.current).toBe(true);
  });

  it("is the very hook the sidebar still exports", () => {
    expect(sidebarUseMounted).toBe(useMounted);
  });
});
