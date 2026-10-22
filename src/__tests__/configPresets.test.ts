// @vitest-environment node
// The config presets every app extends (config/*.mjs). Plain JS so Node, Next and Vitest can load
// them from node_modules; checked here through their .d.mts types.

import { describe, expect, it } from "vitest";

import { securityHeaders, withMintyDefaults } from "../../config/next.mjs";
import { mintyVitest } from "../../config/vitest.mjs";
import * as refJs from "../../config/companyRef.mjs";
import { credentials, mintModuleToken } from "../../config/e2e.mjs";
import * as refTs from "../lib/companyRef";
import { decodeJwtPayload } from "../lib/auth";

describe("securityHeaders", () => {
  it("sends the four headers everywhere and HSTS only in production", () => {
    const dev = securityHeaders("development").map((h) => h.key);
    expect(dev).toEqual([
      "Referrer-Policy",
      "X-Content-Type-Options",
      "Content-Security-Policy",
      "X-Frame-Options",
    ]);
    expect(securityHeaders("production").at(-1)).toEqual({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
  });
});

describe("withMintyDefaults", () => {
  it("compiles @minty/shared, hides X-Powered-By and allows 127.0.0.1 in dev", () => {
    const config = withMintyDefaults({});
    expect(config.transpilePackages).toEqual(["@minty/shared"]);
    expect(config.poweredByHeader).toBe(false);
    expect(config.allowedDevOrigins).toEqual(["127.0.0.1"]);
  });

  it("keeps the app's own keys and adds to its transpilePackages and headers", async () => {
    const config = withMintyDefaults({
      env: { A: "1" },
      transpilePackages: ["other", "@minty/shared"],
      async headers() {
        return [{ source: "/x", headers: [{ key: "X-Own", value: "1" }] }];
      },
    });
    expect(config.env).toEqual({ A: "1" });
    expect(config.transpilePackages).toEqual(["@minty/shared", "other"]);
    const headers = await config.headers!();
    expect(headers.map((h) => h.source)).toEqual(["/:path*", "/x"]);
  });
});

describe("mintyVitest", () => {
  it("points @ at the config's folder and inlines @minty/shared", () => {
    const config = mintyVitest("file:///C:/app/vitest.config.ts", { exclude: ["public/**"] });
    expect(String((config.resolve?.alias as Record<string, string>)["@"])).toMatch(/app$/);
    expect(config.test?.server?.deps?.inline).toEqual(["@minty/shared"]);
    expect(config.test?.exclude).toContain("public/**");
    expect(config.test?.exclude).toContain("**/e2e/**");
  });
});

describe("config/companyRef.mjs", () => {
  it("gives the same answers as src/lib/companyRef.ts", () => {
    const names = ["Olive & Vine", "  ", null, "茶餐廳 Ltd", "a".repeat(80), "--Co--", "É&Co"];
    const ids = ["360812E1-9f94-46a3-aa31-347e21afde8e", "ab", ""];
    for (const name of names) {
      expect(refJs.slugifyName(name)).toBe(refTs.slugifyName(name));
      for (const id of ids) expect(refJs.companyRef(id, name)).toBe(refTs.companyRef(id, name));
    }
    for (const id of ids) expect(refJs.shortIdOf(id)).toBe(refTs.shortIdOf(id));
  });
});

describe("config/e2e.mjs", () => {
  it("mints a token the apps can read, with the hand-off's claims", () => {
    const token = mintModuleToken(
      { secret: "s", userId: "u1", entityId: "e1" },
      { role: "member" },
    );
    const claims = decodeJwtPayload(token) as Record<string, unknown>;
    expect(claims).toMatchObject({ user_id: "u1", entity_id: "e1", role: "member", sid: "e2e" });
    expect(Number(claims.exp) - Number(claims.iat)).toBe(1800);
    expect(token.split(".")).toHaveLength(3);
    expect(token).not.toMatch(/[=+/]/);
  });

  it("reads the credentials from the environment, or none", () => {
    const saved = { ...process.env };
    try {
      delete process.env.E2E_JWT_SECRET;
      expect(credentials()).toBeNull();
      Object.assign(process.env, {
        E2E_JWT_SECRET: "k",
        E2E_MINTY_USER: "u",
        E2E_MINTY_ENTITY: "e",
      });
      delete process.env.E2E_MINTY_ENTITY_NAME;
      expect(credentials()).toEqual({
        secret: "k",
        userId: "u",
        entityId: "e",
        entityName: "E2E Petty Cash Shop",
      });
    } finally {
      process.env = saved;
    }
  });
});
