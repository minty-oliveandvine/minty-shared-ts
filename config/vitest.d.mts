import type { UserConfig } from "vitest/config";

export function mintyVitest(
  configUrl: string,
  options?: { exclude?: string[]; setupFiles?: string[] },
): UserConfig;
