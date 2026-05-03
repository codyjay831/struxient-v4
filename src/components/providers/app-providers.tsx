"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  );
}
