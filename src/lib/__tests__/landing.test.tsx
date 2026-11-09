// The /landing page's logic (lib/landing.ts), ported from minty-web's and minty-petty-cash-web's
// app/__tests__/landing.test.tsx and minty-payment-request-web's app/landing/__tests__/page.test.tsx:
// a token is stored and the page moves on to a SAFE next; no token (or an empty one) is the app's
// own way back, and nothing is stored. Gap 4 (2026-11-09): a one-time code is swapped for the
// token first; a refused code leaves the sentence to show and never redirects by itself.

import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HANDOFF_CODE_REFUSED } from "../handoff";
import {
  _resetLandingForTests,
  readLanding,
  useLandingHandoff,
  type LandingParams,
} from "../landing";

const replace = vi.fn<(href: string) => void>();
const setAuth = vi.fn<(token: string, entityId: string, entityName: string) => void>();
const onNoToken = vi.fn<(landing: LandingParams) => void>();
const router = { replace };
const ACCOUNTS = "https://accounts.test";
const accountsApiUrl = () => ACCOUNTS;
const fetchMock = vi.fn<typeof fetch>();

function Landing({ query, home = "/entities" }: { query: string; home?: string }) {
  const { refused } = useLandingHandoff({
    searchParams: new URLSearchParams(query),
    router,
    setAuth,
    home,
    onNoToken,
    accountsApiUrl,
  });
  return refused ? <p role="alert">{refused}</p> : null;
}

const swapAnswers = (status: number, body: unknown) =>
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

beforeEach(() => {
  replace.mockReset();
  setAuth.mockReset();
  onNoToken.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  _resetLandingForTests();
});

afterEach(() => vi.unstubAllGlobals());

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
      code: "",
      token: "t",
      entityId: "e",
      entityName: "Olive & Vine",
      next: "/a?b=1#c",
    });
    expect(readLanding(new URLSearchParams(""), "/home")).toEqual({
      code: "",
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
      code: "",
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

  it("swaps a one-time code for the token, then stores it and moves on (gap 4)", async () => {
    swapAnswers(200, { token: "swapped.jwt" });
    render(<Landing query="code=c0de&entity_id=e1&entity_name=Co&next=%2Fsubscription" />);
    await waitFor(() => expect(setAuth).toHaveBeenCalledWith("swapped.jwt", "e1", "Co"));
    expect(replace).toHaveBeenCalledWith("/subscription");
    expect(fetchMock.mock.calls[0][0]).toBe(`${ACCOUNTS}/api/handoff/redeem`);
    expect(onNoToken).not.toHaveBeenCalled();
  });

  it("swaps the code once even when React runs the effect twice (Strict Mode)", async () => {
    swapAnswers(200, { token: "swapped.jwt" });
    render(
      <StrictMode>
        <Landing query="code=once&next=%2Fa" />
      </StrictMode>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/a"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a refused code shows its sentence and goes nowhere by itself", async () => {
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    swapAnswers(400, { error: HANDOFF_CODE_REFUSED });
    render(<Landing query="code=used&next=%2Fa" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(HANDOFF_CODE_REFUSED);
    expect(setAuth).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(onNoToken).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
