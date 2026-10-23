"use client";

import { Newspaper } from "lucide-react";
import { TierLegend } from "@/components/ranking/tier-legend";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getTierColor } from "@/lib/ranking-utils";
import { cn } from "@/lib/utils";
import {
  AGENT_ACCENTS,
  type AgentAccent,
  agentContrast,
  GRADIENT_OPTIONS,
  GRAPHIC_MINIMUM,
  type GradientOption,
  type IconSwatch,
  type Mode,
  TEXT_MINIMUM,
  type TierSwatch,
  worstContrast,
} from "./option-data";

/**
 * The #190 C2 comparison sections of `/design`.
 *
 * Why: the owner picks the gradient treatment and the Autonomous Agents card
 * accent from these renders; nothing outside `/design` changes until then.
 * What: `GradientOptions` shows Current, A, B and C side by side, each with
 * the 9 tool-icon gradients and the 5 tier fills (legend row and badge), and
 * the worst-stop contrast of the glyph or letter on each fill. Current uses
 * the real ToolIcon and getTierColor; A, B and C repeat their markup with the
 * option's classes. `AgentCardOptions` repeats the home page's Autonomous
 * Agents card with each accent. Ratios come from `./option-data`.
 * Test: `tests/unit/design-options-190.test.ts`, `tests/unit/design-page-190.test.tsx`,
 * `tests/visual/design.visual.spec.ts`.
 */

// Path of ToolIcon's generic glyph (components/ui/tool-icon.tsx), repeated so A-C draw the same shape.
const TOOL_GLYPH =
  "M12 2L13.09 5.26L16 2L14.21 5.63L18 3L15.5 6.5L20 4L16.5 8.5L22 6L17.5 11.5L22 10L17 14L22 13L16 17L20 16L14.5 19.5L18 18L13.09 21.74L16 22L12 22L10.91 18.74L8 22L9.79 18.37L6 21L8.5 17.5L4 20L7.5 15.5L2 18L6.5 12.5L2 14L7 10L2 11L8 7L4 8L9.5 4.5L6 6L10.91 2.26L8 2L12 2Z";
const ICON_SIZE = 48;

function Ratio({ value, minimum, prefix }: { value: number; minimum: number; prefix: string }) {
  const passes = value >= minimum;
  return (
    <span className="block text-xs text-muted-foreground" data-ratio={value.toFixed(2)}>
      {prefix} {value.toFixed(2)}:1{" "}
      <span className={passes ? "text-ds-success" : "text-ds-danger"}>{passes ? "pass" : `below ${minimum}`}</span>
    </span>
  );
}

function OptionIcon({ option, swatch }: { option: GradientOption; swatch: IconSwatch }) {
  if (option.id === "current") {
    return swatch.glyph === "news" ? (
      <ToolIcon name="News" context="news" size={ICON_SIZE} />
    ) : (
      <ToolIcon name={swatch.sampleName} size={ICON_SIZE} />
    );
  }
  // Markup of ToolIcon's NewsIcon and GenericToolIcon fallbacks.
  const glyph = ICON_SIZE * 0.6;
  return swatch.glyph === "news" ? (
    <div className={cn("flex items-center justify-center rounded-lg", swatch.className)} style={{ width: ICON_SIZE, height: ICON_SIZE }}>
      <Newspaper size={glyph} className="text-ds-text-on-fill" />
    </div>
  ) : (
    <div
      className={cn("flex items-center justify-center rounded-lg border-2 border-border", swatch.className)}
      style={{ width: ICON_SIZE, height: ICON_SIZE }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-ds-text-on-fill" aria-label={`${swatch.hue} icon`}>
        <title>{swatch.hue}</title>
        <path d={TOOL_GLYPH} fill="currentColor" />
      </svg>
    </div>
  );
}

/** Tier fill classes: getTierColor for Current (less `border-0` in the legend, as TierLegend has none). */
function tierClass(option: GradientOption, swatch: TierSwatch, place: "legend" | "badge"): string {
  if (option.id === "current") {
    const cls = getTierColor(swatch.tier);
    return place === "legend" ? cls.replace(" border-0", "") : cls;
  }
  return place === "badge" ? `${swatch.className} border-0` : swatch.className;
}

function OptionColumn({ option, mode }: { option: GradientOption; mode: Mode }) {
  return (
    <div data-design-component="gradient-option" data-design-state={option.id} className="min-w-0 space-y-4 rounded-lg border border-border p-4">
      <div>
        <p className="text-base font-semibold">{option.title}</p>
        <p className="text-xs text-muted-foreground">{option.summary}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tool icons (glyph, 3:1)</p>
        <div className="grid grid-cols-3 gap-3">
          {option.icons.map((swatch) => (
            <div key={swatch.hue} data-swatch={`icon-${swatch.hue}`} className="min-w-0 space-y-1">
              <OptionIcon option={option} swatch={swatch} />
              <span className="block text-xs">{swatch.hue}</span>
              <Ratio prefix="white" value={worstContrast({ token: "ds-text-on-fill" }, swatch.stops, mode)} minimum={GRAPHIC_MINIMUM} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tier legend and badge (text, 4.5:1)</p>
        <div className="space-y-2">
          {option.tiers.map((swatch) => (
            <div key={swatch.tier} data-swatch={`tier-${swatch.tier}`} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${tierClass(option, swatch, "legend")} font-bold px-3 py-1`}>{swatch.tier}</Badge>
                <span className="text-sm font-medium">{swatch.label}</span>
                <Badge className={`${tierClass(option, swatch, "badge")} font-bold px-2 py-0.5`}>{swatch.tier}</Badge>
              </div>
              <Ratio
                prefix={"token" in swatch.text && swatch.text.token === "ds-score-fg" ? "text" : "white"}
                value={worstContrast(swatch.text, swatch.stops, mode)}
                minimum={TEXT_MINIMUM}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GradientOptions({ mode }: { mode: Mode }) {
  return (
    <section className="space-y-4" data-design-section="gradient-options">
      <div>
        <h3 className="text-lg font-semibold">Gradient options (C2, not chosen yet)</h3>
        <p className="text-sm text-muted-foreground">
          Tool-icon and tier fills under each option. Ratios are the glyph or letter against the fill&apos;s lighter stop.
          Production still renders Current.
        </p>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GRADIENT_OPTIONS.map((option) => (
          <OptionColumn key={option.id} option={option} mode={mode} />
        ))}
      </div>
      <div data-design-component="tier-legend" data-design-state="current">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Current TierLegend component, for reference</p>
        <TierLegend />
      </div>
    </section>
  );
}

function AgentCard({ accent, dict }: { accent: AgentAccent; dict: Dictionary }) {
  // Markup of the Autonomous Agents card in app/[lang]/page.tsx, with the accent's classes. The
  // page wraps it in an h-full Link; here the wrapper is auto height so the card ends at its content.
  return (
    <div>
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 ${accent.border} h-full`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            {dict.categories.autonomousAgent}
            <Badge className={accent.badge}>12</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{dict.home.categories.agentDescription}</p>
          <p className={`text-sm ${accent.text} mt-3 group-hover:underline`}>{dict.common.explore} →</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AgentCardOptions({ mode, dict }: { mode: Mode; dict: Dictionary }) {
  return (
    <section className="space-y-4" data-design-section="agent-card-options">
      <div>
        <h3 className="text-lg font-semibold">Autonomous Agents card accent (C2, not chosen yet)</h3>
        <p className="text-sm text-muted-foreground">
          The home page category card with each candidate accent. Ratios: link text on the card, and badge text on its 10% tint.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {AGENT_ACCENTS.map((accent) => {
          const ratio = agentContrast(accent, mode);
          return (
            <div key={accent.id} data-design-component="agent-card" data-design-state={accent.id} className="min-w-0 space-y-2">
              <p className="text-sm font-medium">{accent.title}</p>
              <p className="text-xs text-muted-foreground">{accent.note}</p>
              <AgentCard accent={accent} dict={dict} />
              <Ratio prefix="text on card" value={ratio.text} minimum={TEXT_MINIMUM} />
              <Ratio prefix="badge text on tint" value={ratio.badge} minimum={TEXT_MINIMUM} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
