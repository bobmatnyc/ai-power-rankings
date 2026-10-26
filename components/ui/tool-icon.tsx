"use client";

import { Newspaper } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import logoManifestJson from "@/data/logos/manifest.json";
import { hasManifestEntry, logoManifestSchema, permittedLogoUrl } from "@/lib/logos/manifest";
import { vendorForTool } from "@/lib/logos/vendor-map";
import { cn } from "@/lib/utils";

/**
 * Why: a tool needs a thumbnail, but a vendor mark may be shown only where its terms allow
 *   it, and a runtime favicon or logo fetch is hotlinking.
 * What: renders, in order, (a) the vendor's `permitted` mark from `public/logos/`, (b) the
 *   tool's stored local logo path (a path starting with `/`; legacy, kept until L2; skipped
 *   when the manifest records the vendor with a non-`permitted` status), and
 *   (c) a monogram of the vendor name, else the tool name, on a colour derived from the slug.
 *   No code path requests a remote image; a website URL is never an image source.
 *   // See D82: the legacy `public/tool-icons` PNGs in (b) are re-sourced or removed in L2.
 * Test: `tests/unit/tool-icon-logos.test.tsx`, `tests/unit/tool-icon-manifest.test.tsx`
 */

interface ToolIconProps {
  name: string;
  /** The tool slug: selects the vendor and seeds the monogram colour. */
  slug?: string;
  /** The tool's stored logo; used only when it is a local path starting with `/`. */
  logo?: string | null;
  size?: number;
  className?: string;
  context?: "news" | "default";
}

const manifest = logoManifestSchema.parse(logoManifestJson);

// #190 C2 (Option B): --ds-grad-* HSL tokens; green, orange and teal use the 700-800 steps
// so the white initials meet 3:1 (large bold text). Order is the hash index; keep it.
const MONOGRAM_COLOURS = [
  "bg-gradient-to-br from-ds-grad-blue-500 to-ds-grad-blue-600",
  "bg-gradient-to-br from-ds-grad-purple-500 to-ds-grad-purple-600",
  "bg-gradient-to-br from-ds-grad-green-700 to-ds-grad-green-800",
  "bg-gradient-to-br from-ds-grad-orange-700 to-ds-grad-orange-800",
  "bg-gradient-to-br from-ds-grad-pink-500 to-ds-grad-pink-600",
  "bg-gradient-to-br from-ds-grad-indigo-500 to-ds-grad-indigo-600",
  "bg-gradient-to-br from-ds-grad-teal-700 to-ds-grad-teal-800",
  "bg-gradient-to-br from-ds-grad-red-500 to-ds-grad-red-600",
];

function colourFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return MONOGRAM_COLOURS[Math.abs(hash) % MONOGRAM_COLOURS.length] as string;
}

/** Up to `max` initials: the first letters of the first two words (camelCase splits), else the first two letters. */
function initialsOf(name: string, max: number): string {
  const words = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1 ? [...(words[0] as string)].slice(0, 2) : words.slice(0, 2).map((w) => [...w][0] as string);
  return letters.slice(0, max).join("").toUpperCase();
}

export function ToolIcon({ name, slug, logo, size = 48, className, context = "default" }: ToolIconProps) {
  const [imageError, setImageError] = useState(false);
  const vendor = vendorForTool(slug);

  // D82/#303: a vendor the manifest records without a permitted file (monogram or reference-only)
  // always gets the monogram; the legacy `logo` prop is for vendors the manifest does not cover.
  const permitted = vendor ? permittedLogoUrl(manifest, vendor.vendor) : null;
  const covered = vendor ? hasManifestEntry(manifest, vendor.vendor) : false;
  const legacy = !covered && logo?.startsWith("/") ? logo : null;
  const src = imageError ? null : (permitted ?? legacy);

  if (src) {
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <Image
          src={src}
          alt={`${vendor?.vendor_name ?? name} logo`}
          width={size}
          height={size}
          className={cn("rounded-lg", className)}
          onError={() => setImageError(true)}
          quality={85}
          unoptimized // local files, already sized
        />
      </div>
    );
  }

  const label = (vendor?.vendor_name ?? name ?? "").trim();
  if (!label) {
    // No name to abbreviate: the news fallback keeps its glyph, any other context draws nothing.
    return context === "news" ? (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg",
          "bg-gradient-to-br from-ds-grad-gray-500 to-ds-grad-gray-600", // #190 C2
          className
        )}
        style={{ width: size, height: size }}
      >
        <Newspaper size={size * 0.6} className="text-ds-text-on-fill" aria-hidden="true" />
      </div>
    ) : null;
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-lg font-bold text-ds-text-on-fill select-none",
        colourFor(slug || label),
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialsOf(label, size < 24 ? 1 : 2)}
    </div>
  );
}
