import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "vl_cookie_consent";

export function useCookieConsent() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export default function CookieConsent({ onConsent }) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Slight delay so the banner slides in after the page loads
      const t = setTimeout(() => {
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      }, 800);
      return () => clearTimeout(t);
    }
  }, []);

  const save = (analytics) => {
    const consent = { analytics, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    setVisible(false);
    setTimeout(() => setMounted(false), 400);
    onConsent?.(consent);
  };

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-500 ease-out",
        visible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="mx-auto max-w-screen-xl">
        <div className="m-4 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-sm p-5 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 mb-1">
                We value your privacy
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                We use essential cookies to make the site work, and optional analytics
                cookies (PostHog) to understand how visitors use it. No data is sold or
                shared with advertisers.{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-zinc-200 transition-colors"
                >
                  Privacy policy
                </a>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => save(false)}
                className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 text-xs"
              >
                Essential only
              </Button>
              <Button
                size="sm"
                onClick={() => save(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs"
              >
                Accept all
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
