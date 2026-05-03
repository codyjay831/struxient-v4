"use client";

// Appearance is localStorage-only (storageKey). Same-origin /portal routes inherit
// the last selected theme on that browser — acceptable MVP; not a security concern.

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="struxient-ui-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
