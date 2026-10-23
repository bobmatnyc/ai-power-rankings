"use client";

import { AlertCircle, Home, List, Newspaper } from "lucide-react";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { RankingCard } from "@/components/ranking/ranking-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RankingChange } from "@/components/ui/ranking-change";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { I18nProvider } from "@/i18n/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { getTierColor } from "@/lib/ranking-utils";
import { cn } from "@/lib/utils";
import { ForceStates } from "./force-states";

/**
 * The `/design` state sheet (#190).
 *
 * Why: one place to review the core components in every state, light and
 * dark, and the page the visual tests snapshot.
 * What: renders the same samples twice, in a light panel and in a panel with
 * the `.dark` class (the site has no theme toggle). Each sample is marked
 * `data-design-component` / `data-design-state`; hover and focus samples also
 * carry `data-force-state`, which `ForceStates` turns into the components'
 * own hover and focus styles. Existing components are used as they are. Nav
 * items and score pills have no component of their own yet, so they repeat
 * the markup of `AppSidebar` and `RankingCard`.
 * Test: `tests/unit/design-page-190.test.tsx`, `tests/visual/design.visual.spec.ts`.
 */

const MODES = ["light", "dark"] as const;
type Mode = (typeof MODES)[number];

const BADGE_VARIANTS: NonNullable<BadgeProps["variant"]>[] = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "success",
  "warning",
  "info",
];

const TIERS = ["S", "A", "B", "C", "D"] as const;

const SAMPLE_RANKING = {
  rank: 2,
  previousRank: 4,
  tool: {
    id: "sample-tool",
    slug: "sample-tool",
    name: "Sample Tool",
    category: "code-editor",
    status: "active",
    description: "A sample entry that shows the ranking card layout.",
  },
  scores: { overall: 87.4, agentic_capability: 8.2, innovation: 7.9 },
  metrics: { swe_bench_score: 61.5 },
};

const TABLE_ROWS = [
  { rank: 1, name: "Sample Tool A", score: "91.2" },
  { rank: 2, name: "Sample Tool B", score: "87.4" },
  { rank: 3, name: "Sample Tool C", score: "84.0" },
];

/** One labelled sample. `hover` and `focus` samples force that state on everything inside. */
function Sample({
  component,
  state,
  label,
  force = true,
  children,
}: {
  component: string;
  state: string;
  label?: string;
  force?: boolean;
  children: ReactNode;
}) {
  const forced = force && (state === "hover" || state === "focus") ? state : undefined;
  return (
    <div data-design-component={component} data-design-state={state} data-force-state={forced} className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label ?? state}</p>
      {children}
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function NavItem({ state, icon: Icon, title }: { state: string; icon: typeof Home; title: string }) {
  // Markup of a primary link in components/layout/app-sidebar.tsx.
  const active = state === "active";
  return (
    <Sample component="nav" state={state}>
      <nav className="space-y-1 max-w-xs">
        <a
          href="#nav-sample"
          className={cn(
            "flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
            active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-4 w-4" />
            <span>{title}</span>
          </div>
          {active && (
            <Badge variant="default" className="ml-auto">
              3
            </Badge>
          )}
        </a>
      </nav>
    </Sample>
  );
}

function ScorePills({ state }: { state: string }) {
  // Markup of the tier and score badges in components/ranking/ranking-card.tsx.
  return (
    <Sample component="score-pill" state={state}>
      <div className="flex flex-wrap items-center gap-2">
        {TIERS.map((tier) => (
          <Badge key={tier} className={`${getTierColor(tier)} font-bold px-2 py-0.5`}>
            {tier}
          </Badge>
        ))}
        <Badge variant="outline">Score: 87.4</Badge>
      </div>
    </Sample>
  );
}

function Samples() {
  return (
    <div className="space-y-8">
      <Group title="Card" note="Card from components/ui/card and RankingCard from components/ranking.">
        <div className="grid gap-6 md:grid-cols-2">
          {(["default", "hover"] as const).map((state) => (
            <Sample key={state} component="card" state={state} label={`Card, ${state}`} force={false}>
              <Card data-force-state={state === "hover" ? "hover" : undefined}>
                <CardHeader>
                  <CardTitle>Card title</CardTitle>
                  <CardDescription>Supporting text in the muted foreground.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">Card body content.</p>
                </CardContent>
              </Card>
            </Sample>
          ))}
          {(["default", "hover", "focus"] as const).map((state) => (
            <Sample key={`ranking-${state}`} component="card" state={state} label={`Ranking card, ${state}`}>
              {/* RankingCard fills its parent's height; this div keeps the label out of that height. */}
              <div>
                <RankingCard ranking={SAMPLE_RANKING} listName="design" />
              </div>
            </Sample>
          ))}
        </div>
      </Group>

      <Group title="Table" note="components/ui/table.">
        <div className="grid gap-6">
          {(["default", "hover", "selected"] as const).map((state) => (
            <Sample key={state} component="table" state={state} force={false}>
              <Table>
                <TableCaption>Ranking table, {state} row state.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TABLE_ROWS.map((row) => (
                    <TableRow
                      key={row.rank}
                      data-force-state={state === "hover" && row.rank === 2 ? "hover" : undefined}
                      data-state={state === "selected" && row.rank === 2 ? "selected" : undefined}
                    >
                      <TableCell>{row.rank}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Sample>
          ))}
        </div>
      </Group>

      <Group title="Badge" note="components/ui/badge, every variant.">
        <div className="grid gap-6">
          {(["default", "hover", "focus"] as const).map((state) => (
            <Sample key={state} component="badge" state={state} force={false}>
              <div className="flex flex-wrap items-center gap-2">
                {BADGE_VARIANTS.map((variant) => (
                  <Badge
                    key={variant}
                    variant={variant}
                    data-force-state={state === "default" ? undefined : state}
                    // A focused badge is a focusable one.
                    tabIndex={state === "focus" ? 0 : undefined}
                  >
                    {variant}
                  </Badge>
                ))}
              </div>
            </Sample>
          ))}
        </div>
      </Group>

      <Group title="Score pill" note="Tier badges S to D and the overall score, as RankingCard renders them.">
        <div className="grid gap-6">
          <ScorePills state="default" />
          <ScorePills state="hover" />
        </div>
      </Group>

      <Group title="Rank change" note="RankingChange from components/ui/ranking-change, sizes sm, md and lg.">
        <div className="grid gap-6 md:grid-cols-2">
          {(
            [
              ["new", undefined, 3],
              ["up", 5, 2],
              ["down", 2, 5],
              ["steady", 3, 3],
            ] as const
          ).map(([state, previousRank, currentRank]) => (
            <Sample key={state} component="rank-change" state={state}>
              <div className="flex flex-wrap items-center gap-4">
                {(["sm", "md", "lg"] as const).map((size) => (
                  <RankingChange key={size} previousRank={previousRank} currentRank={currentRank} size={size} />
                ))}
              </div>
            </Sample>
          ))}
        </div>
      </Group>

      {/* #190 PR C1: the Alert, form-control and modifier-text samples show the a11y fixes. */}
      <Group title="Alert" note="Alert from components/ui/alert, default and destructive.">
        <div className="grid gap-6 md:grid-cols-2">
          {(["default", "destructive"] as const).map((variant) => (
            <Sample key={variant} component="alert" state={variant}>
              <Alert variant={variant}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {variant === "default" ? "An informational message." : "The import failed: 3 rows were rejected."}
                </AlertDescription>
              </Alert>
            </Sample>
          ))}
        </div>
      </Group>

      <Group title="Form controls" note="Input, Select, Textarea and the outline Button from components/ui.">
        <div className="grid gap-6 md:grid-cols-2">
          {(["default", "focus"] as const).map((state) => (
            <Sample key={state} component="form-control" state={state}>
              <div className="space-y-3">
                <Input aria-label={`Sample input, ${state}`} placeholder="Search tools" />
                <Select>
                  <SelectTrigger aria-label={`Sample select, ${state}`}>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                </Select>
                <Textarea aria-label={`Sample textarea, ${state}`} placeholder="Notes" />
                <Button variant="outline">Outline button</Button>
              </div>
            </Sample>
          ))}
        </div>
      </Group>

      <Group title="Modifier text" note="The rankings table's modifier colours, as it renders them.">
        <Sample component="modifier-text" state="default">
          <div className="text-sm space-y-1">
            <div className="text-ds-warning">Decay: 72%</div>
            <div className="text-ds-success">Risk: +0.4</div>
            <div className="text-ds-danger-fixed">Risk: -0.6</div>
            <div className="text-ds-accent-fixed">Quality: 64%</div>
          </div>
        </Sample>
      </Group>

      <Group title="Nav" note="A sidebar navigation link, as AppSidebar renders it.">
        <div className="grid gap-6 md:grid-cols-2">
          <NavItem state="default" icon={Home} title="Home" />
          <NavItem state="hover" icon={Newspaper} title="News" />
          <NavItem state="focus" icon={Newspaper} title="News" />
          <NavItem state="active" icon={List} title="Rankings" />
        </div>
      </Group>

      <Group title="Footer" note="Footer from components/layout/footer; hover and focus apply to every link.">
        <div className="space-y-6">
          {(["default", "hover", "focus"] as const).map((state) => (
            <Sample key={state} component="footer" state={state}>
              <Footer />
            </Sample>
          ))}
        </div>
      </Group>

      <p className="text-sm text-muted-foreground">
        Disabled: only the form controls have a disabled state (50% opacity); it is not sampled.
      </p>
    </div>
  );
}

function ModePanel({ mode }: { mode: Mode }) {
  return (
    <section data-design-mode={mode} className={cn("bg-background text-foreground py-8", mode === "dark" && "dark")}>
      <div className="container mx-auto px-4 space-y-8">
        <h2 className="text-2xl font-bold">{mode === "light" ? "Light" : "Dark"}</h2>
        <Samples />
      </div>
    </section>
  );
}

export function DesignPreview({ dict }: { dict: Dictionary }) {
  return (
    <I18nProvider dict={dict} lang="en">
      <ForceStates />
      <main className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8 space-y-2">
          <h1 className="text-2xl font-bold">Design system preview</h1>
          <p className="text-sm text-muted-foreground">
            Core components in each state, light and dark. Guide: docs/refresh/design-system.md.
          </p>
        </div>
        {MODES.map((mode) => (
          <ModePanel key={mode} mode={mode} />
        ))}
      </main>
    </I18nProvider>
  );
}
