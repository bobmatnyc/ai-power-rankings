// Typography and Animate plugins removed to reduce CSS bundle size
// import tailwindcssTypography from "@tailwindcss/typography";
// import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  mode: "jit", // Enable JIT mode for better performance
  darkMode: ["class"],
  content: [
    // Single comprehensive pattern to avoid duplication
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  // ULTRA-MINIMAL safelist - only absolutely critical classes
  safelist: [
    // Next.js specific
    "__next",
    // Dark mode toggle
    "dark",
    // Only the most critical dynamic classes
    "text-primary",
    "bg-primary",
    "border-primary",
  ],
  theme: {
    // Remove container to save CSS
    // container: {},
    extend: {
      // MINIMAL theme extensions - only absolute essentials
      colors: {
        // Only the most critical CSS variable colors
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    // Plugins removed to reduce CSS bundle size
    // Use inline styles or CSS-in-JS for typography and animations
  ],
  // AGGRESSIVE: Disable most core plugins to minimize CSS
  corePlugins: {
    // Layout - keep only essential
    aspectRatio: false,
    container: false,
    columns: false,
    breakAfter: false,
    breakBefore: false,
    breakInside: false,
    boxDecorationBreak: false,
    boxSizing: true, // Essential
    display: true, // Essential
    float: false,
    clear: false,
    isolation: false,
    objectFit: false,
    objectPosition: false,
    overflow: true, // Essential
    overscrollBehavior: false,
    position: true, // Essential
    visibility: true, // Essential
    zIndex: true, // Essential

    // Flexbox & Grid - keep essentials
    flexBasis: true,
    flexDirection: true,
    flexWrap: true,
    flex: true,
    flexGrow: true,
    flexShrink: true,
    order: false,
    gridTemplateColumns: true,
    gridColumn: true,
    gridColumnStart: false,
    gridColumnEnd: false,
    gridTemplateRows: true,
    gridRow: true,
    gridRowStart: false,
    gridRowEnd: false,
    gridAutoFlow: false,
    gridAutoColumns: false,
    gridAutoRows: false,
    gap: true,
    justifyContent: true,
    justifyItems: true,
    justifySelf: false,
    alignContent: true,
    alignItems: true,
    alignSelf: false,
    placeContent: false,
    placeItems: false,
    placeSelf: false,

    // Spacing - keep essentials
    padding: true,
    margin: true,
    space: true,

    // Sizing - keep essentials
    width: true,
    minWidth: true,
    maxWidth: true,
    height: true,
    minHeight: true,
    maxHeight: true,
    size: false,

    // Typography - keep essentials
    fontFamily: true,
    fontSize: true,
    fontSmoothing: false,
    fontStyle: true,
    fontWeight: true,
    fontVariantNumeric: false,
    letterSpacing: false,
    lineClamp: false,
    lineHeight: true,
    listStyleImage: false,
    listStylePosition: false,
    listStyleType: false,
    textAlign: true,
    textColor: true,
    textDecoration: true,
    textDecorationColor: false,
    textDecorationStyle: false,
    textDecorationThickness: false,
    textUnderlineOffset: false,
    textTransform: false,
    textOverflow: true,
    textWrap: false,
    textIndent: false,
    verticalAlign: false,
    whitespace: true,
    wordBreak: false,
    hyphens: false,
    content: false,

    // Backgrounds - keep minimal
    backgroundAttachment: false,
    backgroundColor: true,
    backgroundOrigin: false,
    backgroundPosition: false,
    backgroundRepeat: false,
    backgroundSize: false,
    backgroundImage: false,
    gradientColorStops: false,

    // Borders - keep essentials
    borderRadius: true,
    borderWidth: true,
    borderColor: true,
    borderStyle: false,
    borderOpacity: false,
    divideWidth: false,
    divideColor: false,
    divideStyle: false,
    divideOpacity: false,
    outlineWidth: false,
    outlineStyle: false,
    outlineOffset: false,
    outlineColor: false,

    // Effects - all disabled
    boxShadow: false,
    boxShadowColor: false,
    opacity: true, // Keep for transitions
    mixBlendMode: false,
    backgroundBlendMode: false,

    // Filters - all disabled
    blur: false,
    brightness: false,
    contrast: false,
    dropShadow: false,
    grayscale: false,
    hueRotate: false,
    invert: false,
    saturate: false,
    sepia: false,
    backdropBlur: false,
    backdropBrightness: false,
    backdropContrast: false,
    backdropGrayscale: false,
    backdropHueRotate: false,
    backdropInvert: false,
    backdropOpacity: false,
    backdropSaturate: false,
    backdropSepia: false,
    backdropFilter: false,
    filter: false,

    // Tables - disabled
    tableLayout: false,
    captionSide: false,
    borderCollapse: false,
    borderSpacing: false,

    // Transitions & Animation - minimal
    transitionProperty: true,
    transitionTimingFunction: true,
    transitionDuration: true,
    transitionDelay: false,
    animation: false, // Use CSS-in-JS for animations

    // Transforms - disabled
    transform: false,
    transformOrigin: false,
    scale: false,
    rotate: false,
    translate: false,
    skew: false,

    // Interactivity - keep essentials
    accentColor: false,
    appearance: false,
    cursor: true,
    caretColor: false,
    pointerEvents: true,
    resize: false,
    scrollBehavior: false,
    scrollMargin: false,
    scrollPadding: false,
    scrollSnapAlign: false,
    scrollSnapStop: false,
    scrollSnapType: false,
    touchAction: false,
    userSelect: false,
    willChange: false,

    // SVG - disabled
    fill: false,
    stroke: false,
    strokeWidth: false,

    // Accessibility - keep essential
    screenReaders: true,

    // Others
    preflight: true, // Keep reset styles
    ringWidth: false,
    ringColor: false,
    ringOpacity: false,
    ringOffsetWidth: false,
    ringOffsetColor: false,
  },
};
