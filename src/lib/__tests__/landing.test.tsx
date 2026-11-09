// The /landing page's logic (lib/landing.ts), ported from minty-web's and minty-petty-cash-web's
// app/__tests__/landing.test.tsx and minty-payment-request-web's app/landing/__tests__/page.test.tsx.
// Gap 4 (2026-11-09): a one-time code is swapped for the token, which is stored before the page
// moves on to a SAFE next; a refused code leaves the sentence to show and never redirects by
// itself; no code - an old ?token= link included - is the app's own way back, storing nothing.

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

/** Every swap answers the same - a fresh Response each time (a body can be read only once). */
const swapAnswers = (status: number, body: unknown) =>
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
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
      entityId: "e",
      entityName: "Olive & Vine",
      next: "/a?b=1#c",
    });
    expect(readLanding(new URLSearchParams(""), "/home")).toEqual({
      code: "",
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
  it("never stores a token from the address: an old ?token= link goes the app's way back", () => {
    render(<Landing query="token=t1&entity_id=e1&entity_name=Co&next=%2Fsubscription" />);
    expect(setAuth).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(onNoToken).toHaveBeenCalledWith({
      code: "",
      entityId: "e1",
      entityName: "Co",
      next: "/subscription",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no token: the app's way back with the safe next and the company, storing nothing", () => {
    render(<Landing query="entity_id=e1&entity_name=Co&next=%2F%2Fevil.com" />);
    expect(onNoToken).toHaveBeenCalledWith({
      code: "",
      entityId: "e1",
      entityName: "Co",
      next: "/entities",
    });
    expect(setAuth).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("an empty code counts as none", () => {
    render(<Landing query="code=&next=%2Fprofile" />);
    expect(onNoToken).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it("swaps a one-time code for the token, then stores it and moves on, unsafe next home (gap 4)", async () => {
    swapAnswers(200, { token: "swapped.jwt" });
    render(<Landing query="code=c0de&entity_id=e1&entity_name=Co&next=%2Fsubscription" />);
    await waitFor(() => expect(setAuth).toHaveBeenCalledWith("swapped.jwt", "e1", "Co"));
    expect(replace).toHaveBeenCalledWith("/subscription");
    _resetLandingForTests();
    render(<Landing query="code=c2&next=https%3A%2F%2Fevil.com" home="/" />);
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith("/"));
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
