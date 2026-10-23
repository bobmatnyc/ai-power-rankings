/**
 * Data for the #190 C2 samples on `/design`: the shipped Option B fills and
 * the Autonomous Agents card's purple accent.
 *
 * Why: each swatch states its contrast, and the ratio must come from the
 * colours the swatch draws.
 * What: the Tailwind 3.4 palette steps behind the --ds-grad-* tokens (as
 * sRGB channels), the mode-dependent token values the samples use, the tool
 * icon and tier fills with the classes the production components use, the
 * Agents-card accent, and WCAG 2.x contrast helpers.
 * Test: `tests/unit/design-options-190.test.ts` checks every value here
 * against app/globals.css, the Tailwind palette and the production
 * components, and the ratios.
 */

export type Mode = "light" | "dark";
export type Rgb = readonly [number, number, number];

/** Tailwind 3.4 palette steps, as sRGB channels. */
export const PALETTE = {
  "blue-500": [59, 130, 246],
  "blue-600": [37, 99, 235],
  "purple-500": [168, 85, 247],
  "purple-600": [147, 51, 234],
  "green-700": [21, 128, 61],
  "green-800": [22, 101, 52],
  "orange-700": [194, 65, 12],
  "orange-800": [154, 52, 18],
  "pink-500": [236, 72, 153],
  "pink-600": [219, 39, 119],
  "indigo-500": [99, 102, 241],
  "indigo-600": [79, 70, 229],
  "teal-700": [15, 118, 110],
  "teal-800": [17, 94, 89],
  "red-500": [239, 68, 68],
  "red-600": [220, 38, 38],
  "gray-500": [107, 114, 128],
  "gray-600": [75, 85, 99],
} as const satisfies Record<string, Rgb>;

export type PaletteStep = keyof typeof PALETTE;

/** Mode-dependent `--ds-*` values the samples use, as written in app/globals.css. */
export const MODE_TOKENS = {
  light: {
    "ds-surface": "0 0% 100%",
    "ds-text-on-fill": "0 0% 100%",
    "ds-score-s": "26 90.5% 37.1%",
    "ds-score-a": "224.3 76.3% 48%",
    "ds-score-b": "142.4 71.8% 29.2%",
    "ds-score-c": "215.3 19.3% 34.5%",
    "ds-score-d": "0 73.7% 41.8%",
    "ds-score-fg": "0 0% 100%",
    "ds-accent-agent": "272.09302326 71.66666667% 47.05882353%",
  },
  dark: {
    "ds-surface": "222.2 84% 4.9%",
    "ds-text-on-fill": "0 0% 100%",
    "ds-score-s": "43.3 96.4% 56.3%",
    "ds-score-a": "213.1 93.9% 67.8%",
    "ds-score-b": "141.9 69.2% 58%",
    "ds-score-c": "215 20.2% 65.1%",
    "ds-score-d": "0 90.6% 70.8%",
    "ds-score-fg": "222.2 84% 4.9%",
    "ds-accent-agent": "270 95.23809524% 75.29411765%",
  },
} as const satisfies Record<Mode, Record<string, string>>;

export type ModeToken = keyof (typeof MODE_TOKENS)["light"];

/** A colour a swatch draws: a fixed palette step, or a token whose value depends on the mode. */
export type Colour = { palette: PaletteStep } | { token: ModeToken };

const p = (step: PaletteStep): Colour => ({ palette: step });
const t = (token: ModeToken): Colour => ({ token });

/** `"217 91% 59%"` to 8-bit sRGB channels, rounded as scripts/design-tokens.ts rounds. */
export function hslToRgb(hsl: string): Rgb {
  const [h, s, l] = hsl.trim().split(/\s+/).map((part) => Number.parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round((light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [channel(0), channel(8), channel(4)];
}

export function resolve(colour: Colour, mode: Mode): Rgb {
  return "palette" in colour ? PALETTE[colour.palette] : hslToRgb(MODE_TOKENS[mode][colour.token]);
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` over `bg`, as an opacity-modifier tint (`/10`) composites it. */
export function mix(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as unknown as Rgb;
}

/** The lowest contrast of `text` against any stop: the worst point of a gradient. */
export function worstContrast(text: Colour, stops: readonly Colour[], mode: Mode): number {
  return Math.min(...stops.map((stop) => contrastRatio(resolve(text, mode), resolve(stop, mode))));
}

/** WCAG minimums: 4.5:1 for the tier letters (text), 3:1 for the icon glyphs (graphics). */
export const TEXT_MINIMUM = 4.5;
export const GRAPHIC_MINIMUM = 3;

export type IconSwatch = {
  hue: string;
  /** `news` is ToolIcon's news fallback (Newspaper glyph, no border); `tool` the generic glyph. */
  glyph: "tool" | "news";
  /** A name that makes ToolIcon pick this hue (its name hash). */
  sampleName: string;
  /** The gradient classes, exactly as components/ui/tool-icon.tsx writes them. */
  className: string;
  stops: readonly [Colour, Colour];
};

export type TierSwatch = {
  tier: "S" | "A" | "B" | "C" | "D";
  label: string;
  /** The band classes, as TierLegend writes them (getTierColor adds `border-0`). */
  className: string;
  stops: readonly Colour[];
  text: Colour;
};

const icon = (hue: string, sampleName: string, from: PaletteStep, to: PaletteStep, className: string): IconSwatch => ({
  hue,
  glyph: hue === "gray" ? "news" : "tool",
  sampleName,
  className,
  stops: [p(from), p(to)],
});

/** ToolIcon's fills in hash order, then the news fallback. */
export const ICON_SWATCHES: readonly IconSwatch[] = [
  icon("blue", "Sample F", "blue-500", "blue-600", "bg-gradient-to-br from-ds-grad-blue-500 to-ds-grad-blue-600"),
  icon("purple", "Sample G", "purple-500", "purple-600", "bg-gradient-to-br from-ds-grad-purple-500 to-ds-grad-purple-600"),
  icon("green", "Sample H", "green-700", "green-800", "bg-gradient-to-br from-ds-grad-green-700 to-ds-grad-green-800"),
  icon("orange", "Sample A", "orange-700", "orange-800", "bg-gradient-to-br from-ds-grad-orange-700 to-ds-grad-orange-800"),
  icon("pink", "Sample B", "pink-500", "pink-600", "bg-gradient-to-br from-ds-grad-pink-500 to-ds-grad-pink-600"),
  icon("indigo", "Sample C", "indigo-500", "indigo-600", "bg-gradient-to-br from-ds-grad-indigo-500 to-ds-grad-indigo-600"),
  icon("teal", "Sample D", "teal-700", "teal-800", "bg-gradient-to-br from-ds-grad-teal-700 to-ds-grad-teal-800"),
  icon("red", "Sample E", "red-500", "red-600", "bg-gradient-to-br from-ds-grad-red-500 to-ds-grad-red-600"),
  icon("gray", "News", "gray-500", "gray-600", "bg-gradient-to-br from-ds-grad-gray-500 to-ds-grad-gray-600"),
];

const tier = (name: TierSwatch["tier"], label: string, className: string): TierSwatch => ({
  tier: name,
  label,
  className,
  stops: [t(`ds-score-${name.toLowerCase()}` as ModeToken)],
  text: t("ds-score-fg"),
});

export const TIER_SWATCHES: readonly TierSwatch[] = [
  tier("S", "Elite", "bg-ds-score-s hover:bg-ds-score-s text-ds-score-fg"),
  tier("A", "Excellent", "bg-ds-score-a hover:bg-ds-score-a text-ds-score-fg"),
  tier("B", "Good", "bg-ds-score-b hover:bg-ds-score-b text-ds-score-fg"),
  tier("C", "Average", "bg-ds-score-c hover:bg-ds-score-c text-ds-score-fg"),
  tier("D", "Below Average", "bg-ds-score-d hover:bg-ds-score-d text-ds-score-fg"),
];

// #190 C2: the owner picked purple; the red, teal and amber candidates are gone.
export type AgentAccent = {
  token: ModeToken;
  /** Card hover border, count badge, and "Explore" link classes, as app/[lang]/page.tsx writes them. */
  border: string;
  badge: string;
  text: string;
};

export const AGENT_ACCENT: AgentAccent = {
  token: "ds-accent-agent",
  border: "hover:border-ds-accent-agent/20",
  badge: "bg-ds-accent-agent/10 text-ds-accent-agent",
  text: "text-ds-accent-agent",
};

/** The 10% badge tint over the card surface. */
export const BADGE_TINT = 0.1;

/** Text-on-card and badge-text-on-tint ratios for one accent in one mode. */
export function agentContrast(accent: AgentAccent, mode: Mode): { text: number; badge: number } {
  const fg = resolve(t(accent.token), mode);
  const surface = resolve(t("ds-surface"), mode);
  return { text: contrastRatio(fg, surface), badge: contrastRatio(fg, mix(fg, surface, BADGE_TINT)) };
}
