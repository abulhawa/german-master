/**
 * Classifies node module paths into manual chunk buckets for Vite rollup splitting.
 *
 * We keep the logic isolated so that it can be regression tested without importing
 * the entire Vite configuration (which pulls in plugins that rely on browser-like
 * globals when evaluated in a test environment).
 */
export function classifyManualChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("@supabase/")) {
    return "supabase";
  }

  if (
    id.includes("@radix-ui/") ||
    id.includes("cmdk") ||
    id.includes("vaul") ||
    id.includes("input-otp") ||
    id.includes("react-day-picker") ||
    id.includes("next-themes") ||
    id.includes("class-variance-authority") ||
    id.includes("tailwind-merge") ||
    id.includes("clsx")
  ) {
    return "ui-vendor";
  }

  if (id.includes("framer-motion")) {
    return "motion";
  }

  if (id.includes("recharts")) {
    return "recharts";
  }

  if (id.includes("@tanstack/react-query")) {
    return "react-query";
  }

  if (id.includes("lucide-react")) {
    return "icons";
  }

  if (id.includes("date-fns")) {
    return "date-fns";
  }

  if (id.includes("dexie")) {
    return "dexie";
  }

  if (id.includes("embla-carousel")) {
    return "carousel";
  }

  return "vendor";
}
