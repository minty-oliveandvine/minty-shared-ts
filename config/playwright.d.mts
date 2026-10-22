import type { PlaywrightTestConfig } from "@playwright/test";

export const PHONE: { width: number; height: number };
export function mintyPlaywright(options: {
  port: number;
  baseURL?: string;
  testDir?: string;
  testMatch?: string[];
  timeout?: number;
  desktopName?: string;
  phone?: boolean;
}): PlaywrightTestConfig;
