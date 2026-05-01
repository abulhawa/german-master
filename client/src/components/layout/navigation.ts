import type { LucideIcon } from "lucide-react";
import { Sparkles, PenLine, BookOpen, BarChart3, Settings2 } from "lucide-react";
import { ADMIN_FEATURE_ENABLED } from "@/config/admin-feature";
import type { FeatureCapabilities } from "@/lib/features";

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  requiresAdmin?: boolean;
}

const BASE_PRIMARY_NAVIGATION_ITEMS: AppNavigationItem[] = [
  {
    href: "/",
    label: "Practice",
    icon: Sparkles,
    exact: true,
  },
];

const WRITING_NAVIGATION_ITEM: AppNavigationItem = {
  href: "/writing",
  label: "Writing",
  icon: PenLine,
  exact: true,
};

const SECONDARY_PRIMARY_NAVIGATION_ITEMS: AppNavigationItem[] = [
  {
    href: "/wortschatz",
    label: "Wortschatz",
    icon: BookOpen,
    exact: true,
  },
  {
    href: "/progress",
    label: "Progress",
    icon: BarChart3,
  },
];

const ADMIN_NAVIGATION_ITEMS: AppNavigationItem[] = ADMIN_FEATURE_ENABLED
  ? [
      {
        href: "/admin",
        label: "Admin tools",
        icon: Settings2,
        requiresAdmin: true,
      },
    ]
  : [];

export function getPrimaryNavigationItems(
  role: string | null | undefined,
  features: Partial<FeatureCapabilities> = {},
): AppNavigationItem[] {
  const normalizedRole = role?.trim().toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const items = [
    ...BASE_PRIMARY_NAVIGATION_ITEMS,
    ...(features.writingLab ? [WRITING_NAVIGATION_ITEM] : []),
    ...SECONDARY_PRIMARY_NAVIGATION_ITEMS,
    ...ADMIN_NAVIGATION_ITEMS,
  ];
  return items.filter((item) => !item.requiresAdmin || isAdmin);
}

function normalizePath(input: string | null | undefined): string {
  if (!input) {
    return "/";
  }

  const [path] = input.split("?");
  const trimmed = path?.trim() ?? "/";
  if (!trimmed.startsWith("/")) {
    return normalizePath(`/${trimmed}`);
  }

  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.length > 0 ? withoutTrailing : "/";
}

export function isNavigationItemActive(
  currentPath: string,
  item: Pick<AppNavigationItem, "href" | "exact">,
): boolean {
  const normalizedPath = normalizePath(currentPath);
  const normalizedHref = normalizePath(item.href);

  if (item.exact) {
    return normalizedPath === normalizedHref;
  }

  if (normalizedPath === normalizedHref) {
    return true;
  }

  return normalizedPath.startsWith(`${normalizedHref}/`);
}
