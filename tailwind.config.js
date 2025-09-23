import tailwindcssTypography from "@tailwindcss/typography";
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  mode: "jit", // Enable JIT mode for better performance
  darkMode: ["class"],
  content: [
    // Single comprehensive pattern to avoid duplication
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  // AGGRESSIVE OPTIMIZATION: Minimal safelist - only truly dynamic classes
  safelist: [
    // Only keep classes that are dynamically generated and can't be detected by static analysis
    // Custom theme color patterns that are used dynamically
    {
      pattern: /^(bg|text|border)-(primary|secondary|accent|destructive|muted)(-foreground)?$/,
      variants: ["hover", "focus"],
    },
    // Keep only the most critical responsive grid patterns
    "md:grid-cols-2",
    "md:grid-cols-3",
    "md:grid-cols-5",
    // Next.js specific
    "__next",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        inter: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Keep only CSS variable-based colors for dynamic theming
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    // Typography plugin with minimal settings
    tailwindcssTypography({
      // Only generate the essential typography styles
      modifiers: [],
    }),
  ],
  // Optimize for production builds
  corePlugins: {
    // Disable unused core plugins to reduce CSS size
    float: false,
    clear: false,
    skew: false,
    caretColor: false,
    sepia: false,
    hueRotate: false,
    backdropHueRotate: false,
    saturate: false,
    backdropSaturate: false,
    contrast: false,
    backdropContrast: false,
    brightness: false,
    backdropBrightness: false,
    invert: false,
    backdropInvert: false,
    blur: false,
    backdropBlur: false,
    dropShadow: false,
    grayscale: false,
    backdropGrayscale: false,
    backdropFilter: false,
    filter: false,
    ringOffsetColor: false,
    ringOffsetWidth: false,
    ringWidth: false,
    ringColor: false,
    ringOpacity: false,
    boxShadowColor: false,
  },
};
