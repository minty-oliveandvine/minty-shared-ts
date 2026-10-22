import type { NextConfig } from "next";

export function securityHeaders(nodeEnv?: string): { key: string; value: string }[];
export function withMintyDefaults<T extends NextConfig>(config?: T): T & NextConfig;
