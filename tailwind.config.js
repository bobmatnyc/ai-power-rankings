import tailwindcssTypography from "@tailwindcss/typography";
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  mode: "jit", // Enable JIT mode for better performance
  darkMode: ["class"],
  content: [
    // Comprehensive content paths for better CSS purging
    "./pages/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./app/**/*.{ts,tsx,js,jsx}",
    "./src/**/*.{ts,tsx,js,jsx}",
    "./src/app/**/*.{ts,tsx,js,jsx}",
    "./src/components/**/*.{ts,tsx,js,jsx}",
    "./src/lib/**/*.{ts,tsx,js,jsx}",
    "./public/**/*.html",
  ],
  // Optimized safelist based on actual usage analysis (500 classes analyzed, keeping top 177)
  safelist: [
    // Top frequently used layout classes (50+ uses each)
    "flex",
    "items-center",
    "justify-between",
    "justify-center",
    "grid",
    "container",
    "w-full",
    "flex-col",
    "flex-1",
    "items-start",
    "flex-wrap",
    "grid-cols-1",

    // Top spacing classes (20+ uses each)
    "gap-2",
    "gap-3",
    "gap-4",
    "gap-6",
    "mx-auto",
    "mb-2",
    "mb-3",
    "mb-4",
    "mb-6",
    "mb-8",
    "p-4",
    "space-y-2",
    "space-y-3",
    "space-y-4",
    "space-y-6",
    "py-8",
    "mt-1",
    "mt-2",
    "mr-2",

    // Top typography classes (20+ uses each)
    "text-sm",
    "text-lg",
    "text-xs",
    "text-2xl",
    "text-4xl",
    "text-center",
    "font-bold",
    "font-medium",
    "font-semibold",

    // Top size classes (20+ uses each)
    "h-4",
    "h-5",
    "w-4",
    "w-5",
    "rounded-lg",
    "rounded-full",
    "border",

    // Most used custom color classes
    "text-muted-foreground",
    "text-primary",

    // Critical responsive patterns - only keep what's actually used
    "md:grid-cols-2",
    "md:grid-cols-3",
    "md:grid-cols-5",
    "sm:hidden",
    "md:block",
    "lg:grid",

    // Keep custom design system colors that are actually used
    {
      pattern:
        /^(bg|text|border)-(primary|secondary|accent|destructive|muted|sidebar)(-foreground)?$/,
    },

    // Keep only gray colors that are actually used (from analysis)
    { pattern: /^(bg|text|border)-gray-(50|100|200|300|400|500|600|700|800|900)$/ },

    // Keep other colors that showed up in analysis
    {
      pattern:
        /^(bg|text|border)-(blue|green|red|yellow|purple)-(50|100|200|300|400|500|600|700|800|900|950)$/,
    },

    // Common state classes that are actually used
    "hover:bg-accent",
    "hover:text-accent-foreground",
    "hover:bg-gray-50",
    "focus:outline-none",
    "focus:ring-2",
    "disabled:opacity-50",

    // Animation classes (only 7 found in analysis)
    "animate-fade-in",
    "animate-scale-in",
    "animate-accordion-up",
    "animate-accordion-down",
    "transition-all",
    "transition-colors",
    "duration-150",
    "duration-200",

    // Next.js specific
    "__next",
    "__next-route-announcer__",
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
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "scale-in": {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0",
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1",
          },
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
  plugins: [tailwindcssAnimate, tailwindcssTypography],
};
