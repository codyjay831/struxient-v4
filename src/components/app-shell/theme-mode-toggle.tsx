"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light" as const, label: "Light", Icon: Sun },
  { value: "dark" as const, label: "Dark", Icon: Moon },
  { value: "system" as const, label: "System", Icon: Monitor },
];

export function ThemeModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="flex items-center gap-0.5 rounded-sm border border-border bg-muted/30 p-0.5"
        aria-hidden
        data-theme-toggle-placeholder
      >
        {MODES.map(({ value }) => (
          <div key={value} className="size-8 shrink-0 rounded-sm" />
        ))}
      </div>
    );
  }

  const active = theme ?? "dark";

  return (
    <div role="group" aria-label="Appearance" className="flex items-center gap-0.5 rounded-sm border border-border bg-muted/30 p-0.5">
      {MODES.map(({ value, label, Icon }) => {
        const isActive = active === value;
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 shrink-0 rounded-sm",
              isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTheme(value)}
            aria-pressed={isActive}
            aria-label={label}
            title={label}
          >
            <Icon className="size-4" aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}
