// The /landing page's logic (lib/landing.ts), ported from minty-web's and minty-petty-cash-web's
// app/__tests__/landing.test.tsx and minty-payment-request-web's app/landing/__tests__/page.test.tsx:
// a token is stored and the page moves on to a SAFE next; no token (or an empty one) is the app's
// own way back, and nothing is stored.

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readLanding, useLandingHandoff, type LandingParams } from "../landing";

const replace = vi.fn<(href: string) => void>();
const setAuth = vi.fn<(token: string, entityId: string, entityName: string) => void>();
const onNoToken = vi.fn<(landing: LandingParams) => void>();
const router = { replace };

function Landing({ query, home = "/entities" }: { query: string; home?: string }) {
  useLandingHandoff({ searchParams: new URLSearchParams(query), router, setAuth, home, onNoToken });
  return null;
}

beforeEach(() => {
  replace.mockReset();
  setAuth.mockReset();
  onNoToken.mockReset();
});

describe("readLanding", () => {
  it("reads every value, absent ones as empty strings", () => {
    expect(
      readLanding(
        new URLSearchParams(
          "token=t&entity_id=e&entity_name=Olive%20%26%20Vine&next=%2Fa%3Fb%3D1%23c",
        ),
        "/",
      ),
    ).toEqual({
      token: "t",
      entityId: "e",
      entityName: "Olive & Vine",
      next: "/a?b=1#c",
    });
    expect(readLanding(new URLSearchParams(""), "/home")).toEqual({
      token: "",
      entityId: "",
      entityName: "",
      next: "/home",
    });
  });

  it.each(["https://evil.example/steal", "//evil.example/steal", "/\\evil.example", "entity/x"])(
    "refuses %s as next",
    (next) => {
      expect(readLanding(new URLSearchParams({ next }), "/").next).toBe("/");
    },
  );
});

describe("useLandingHandoff", () => {
  it("stores the token with its company and replaces the page with next", () => {
    render(
      <Landing query="token=t1&entity_id=e1&entity_name=Olive%20%26%20Vine&next=%2Fsubscription%3Fa%3D1" />,
    );
    expect(setAuth).toHaveBeenCalledWith("t1", "e1", "Olive & Vine");
    expect(replace).toHaveBeenCalledWith("/subscription?a=1");
    expect(onNoToken).not.toHaveBeenCalled();
  });

  it("an unsafe or missing next goes home; a company not named is stored as empty strings", () => {
    render(<Landing query="token=t1&next=https%3A%2F%2Fevil.com" home="/" />);
    expect(replace).toHaveBeenLastCalledWith("/");
    expect(setAuth).toHaveBeenLastCalledWith("t1", "", "");
  });

  it("no token: the app's way back with the safe next and the company, storing nothing", () => {
    render(<Landing query="entity_id=e1&entity_name=Co&next=%2F%2Fevil.com" />);
    expect(onNoToken).toHaveBeenCalledWith({
      token: "",
      entityId: "e1",
      entityName: "Co",
      next: "/entities",
    });
    expect(setAuth).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("an empty token counts as none", () => {
    render(<Landing query="token=&next=%2Fprofile" />);
    expect(onNoToken).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
