import { Link, useLocation } from "wouter";
import { User } from "lucide-react";

import { AuthDialog } from "@/components/auth/auth-dialog";
import { useAuthSession } from "@/auth/session";
import { useTranslations } from "@/locales";
import { cn } from "@/lib/utils";
import type { AppNavigationItem } from "./navigation";
import { isNavigationItemActive } from "./navigation";
import { useState } from "react";

interface MobileNavBarProps {
  items: AppNavigationItem[];
  showAccount?: boolean;
}

function MobileAccountButton() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const authSession = useAuthSession();
  const accountLabel = useTranslations().userMenu.accountLabel;
  const isSessionLoading = authSession.isLoading || authSession.isFetching;

  return (
    <>
      <button
        type="button"
        className="flex flex-col items-center justify-center gap-0 space-y-0.5 rounded-2xl px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={() => setAuthDialogOpen(true)}
        aria-label={accountLabel}
      >
        <User aria-hidden className="h-5 w-5 text-muted-foreground transition" />
        <span className="text-[11px] tracking-[0.18em]">{accountLabel}</span>
        <span className="mt-1 h-1 w-8 rounded-full bg-accent/70 opacity-0" aria-hidden />
      </button>
      {authDialogOpen ? (
        <AuthDialog
          open={authDialogOpen}
          onOpenChange={setAuthDialogOpen}
          defaultMode="sign-in"
          session={authSession.data ?? null}
          isSessionLoading={isSessionLoading}
        />
      ) : null}
    </>
  );
}

export function MobileNavBar({ items, showAccount = true }: MobileNavBarProps) {
  const [location] = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="flex items-center justify-around gap-1"
    >
      {items.map((item) => {
        const isActive = isNavigationItemActive(location, item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center space-y-0.5 gap-0 rounded-2xl px-2 py-1.5 text-xs font-medium transition",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              aria-hidden
              className={cn(
                "h-5 w-5 transition",
                isActive ? "text-accent" : "text-muted-foreground",
              )}
            />
            <span className="text-[11px] tracking-[0.18em]">{item.label}</span>
            <span
              className={cn(
                "mt-1 h-1 w-8 rounded-full bg-accent/70 transition-opacity",
                isActive ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </Link>
        );
      })}
      {showAccount ? <MobileAccountButton /> : null}
    </nav>
  );
}
