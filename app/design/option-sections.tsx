"use client";

import { TierLegend } from "@/components/ranking/tier-legend";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getTierColor } from "@/lib/ranking-utils";
import {
  AGENT_ACCENT,
  agentContrast,
  GRAPHIC_MINIMUM,
  ICON_SWATCHES,
  type Mode,
  TEXT_MINIMUM,
  TIER_SWATCHES,
  worstContrast,
} from "./option-data";

/**
 * The #190 C2 sections of `/design`.
 *
 * Why: C2 shipped Option B for the tool-icon and tier fills and a purple
 * accent for the Autonomous Agents card; each needs a reviewed render with
 * its contrast.
 * What: `GradientFills` renders the real ToolIcon (every hue and the news
 * fallback), TierLegend and getTierColor badges, each with the worst-stop
 * contrast of its glyph or letter. `AgentCardSample` repeats the home page's
 * Autonomous Agents card with its accent. Ratios come from `./option-data`.
 * Test: `tests/unit/design-options-190.test.ts`, `tests/unit/design-page-190.test.tsx`,
 * `tests/visual/design.visual.spec.ts`.
 */

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

export function GradientFills({ mode }: { mode: Mode }) {
  return (
    <section className="space-y-4" data-design-section="gradient-fills">
      <div>
        <h3 className="text-lg font-semibold">Tool-icon and tier fills (C2 Option B)</h3>
        <p className="text-sm text-muted-foreground">
          ToolIcon on the --ds-grad-* tokens; tier badges on the --ds-score-* bands. Ratios are the glyph or letter
          against the fill&apos;s lighter stop.
        </p>
      </div>
      <div data-design-component="gradient-fill" data-design-state="shipped" className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tool icons (glyph, 3:1)</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {ICON_SWATCHES.map((swatch) => (
              <div key={swatch.hue} data-swatch={`icon-${swatch.hue}`} className="min-w-0 space-y-1">
                {swatch.glyph === "news" ? (
                  <ToolIcon name="" context="news" size={ICON_SIZE} />
                ) : (
                  <ToolIcon name={swatch.sampleName} size={ICON_SIZE} />
                )}
                <span className="block text-xs">{swatch.hue}</span>
                <Ratio prefix="white" value={worstContrast({ token: "ds-text-on-fill" }, swatch.stops, mode)} minimum={GRAPHIC_MINIMUM} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tier badges (text, 4.5:1)</p>
          <div className="space-y-2">
            {TIER_SWATCHES.map((swatch) => (
              <div key={swatch.tier} data-swatch={`tier-${swatch.tier}`} className="flex flex-wrap items-center gap-2">
                <Badge className={`${getTierColor(swatch.tier)} font-bold px-2 py-0.5`}>{swatch.tier}</Badge>
                <span className="text-sm font-medium">{swatch.label}</span>
                <Ratio prefix="text" value={worstContrast(swatch.text, swatch.stops, mode)} minimum={TEXT_MINIMUM} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div data-design-component="tier-legend" data-design-state="shipped">
        <TierLegend />
      </div>
    </section>
  );
}

function AgentCard({ dict }: { dict: Dictionary }) {
  // Markup of the Autonomous Agents card in app/[lang]/page.tsx. The page wraps it in an h-full
  // Link; here the wrapper is auto height so the card ends at its content.
  return (
    <div>
      <Card className={`group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 ${AGENT_ACCENT.border} h-full`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            {dict.categories.autonomousAgent}
            <Badge className={AGENT_ACCENT.badge}>12</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{dict.home.categories.agentDescription}</p>
          <p className={`text-sm ${AGENT_ACCENT.text} mt-3 group-hover:underline`}>{dict.common.explore} →</p>
        </CardContent>
      </Card>
    </div>
  );
}

// #190 C2: the shipped purple card replaces the four-accent comparison.
export function AgentCardSample({ mode, dict }: { mode: Mode; dict: Dictionary }) {
  const ratio = agentContrast(AGENT_ACCENT, mode);
  return (
    <section className="space-y-4" data-design-section="agent-card">
      <div>
        <h3 className="text-lg font-semibold">Autonomous Agents card accent (C2)</h3>
        <p className="text-sm text-muted-foreground">
          The home page category card on --ds-accent-agent: purple-700 light, purple-400 dark. Ratios: link text on the
          card, and badge text on its 10% tint.
        </p>
      </div>
      <div data-design-component="agent-card" data-design-state="shipped" className="max-w-sm space-y-2">
        <AgentCard dict={dict} />
        <Ratio prefix="text on card" value={ratio.text} minimum={TEXT_MINIMUM} />
        <Ratio prefix="badge text on tint" value={ratio.badge} minimum={TEXT_MINIMUM} />
      </div>
    </section>
  );
}
