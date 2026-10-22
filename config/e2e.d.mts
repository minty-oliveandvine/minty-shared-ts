import type { Page } from "@playwright/test";

export type Credentials = { secret: string; userId: string; entityId: string; entityName: string };

export function credentials(): Credentials | null;
export function requireCredentials(): Credentials;
export function mintModuleToken(
  creds: Pick<Credentials, "secret" | "userId" | "entityId"> & Partial<Credentials>,
  overrides?: Record<string, unknown>,
): string;
export function forgedToken(): string;
export function reachable(url: string, timeoutMs?: number): Promise<boolean>;
export function expectNoSideScroll(page: Page): Promise<void>;
export { companyRef, shortIdOf, slugifyName } from "./companyRef.mjs";
