// @vitest-environment node
// Off to Flask from an app's proxy (lib/proxy.ts). Ported from the toFlask pins in minty-web's
// proxy.test.ts and minty-petty-cash-web's __tests__/proxy.test.ts: a plain 307 everywhere but a
// branch preview-set host, which gets a page that refreshes to Flask - now escaping ">" as well.

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { toFlask } from "../proxy";

const request = (host: string) => new NextRequest(`https://${host}/somewhere?x=1`);

describe("toFlask", () => {
  it.each([
    "localhost:3010",
    "my.dailyminty.com",
    "pettycash.dailyminty.com",
    "dev-pettycash.dailyminty.com",
    "minty-petty-cash-web.vercel.app",
    "pr-development-pettycash.dailyminty.com.evil.example",
    "pr--my.dailyminty.com",
  ])("is a plain 307 redirect on %s", (host) => {
    const res = toFlask(request(host), "https://flask.test/h?a=1&b=2");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://flask.test/h?a=1&b=2");
  });

  it.each([
    "pr-development-pettycash.dailyminty.com",
    "pr-feature-x-my.dailyminty.com",
    "pr-a-www.dailyminty.com",
    "pr-feat-payment-request.dailyminty.com",
    "pr-feat-onboarding.dailyminty.com",
  ])("is a page of this host that refreshes to Flask on the preview-set host %s", async (host) => {
    const res = toFlask(request(host), "https://flask.test/handoff?next=%2F");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(
      '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" ' +
        'content="0;url=https://flask.test/handoff?next=%2F"><title>Minty</title>',
    );
  });

  it('escapes &, ", < AND > in the refresh URL', async () => {
    const res = toFlask(
      request("pr-feat-x-my.dailyminty.com"),
      'https://flask.test/handoff?a=1&b="2"<3>&c=&amp;',
    );
    expect(await res.text()).toBe(
      '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" ' +
        'content="0;url=https://flask.test/handoff?a=1&amp;b=&quot;2&quot;&lt;3&gt;&amp;c=&amp;amp;">' +
        "<title>Minty</title>",
    );
  });
});
