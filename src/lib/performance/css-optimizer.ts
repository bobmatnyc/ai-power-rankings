/**
 * CSS Optimization Utilities
 * Helps reduce unused CSS and optimize bundle size
 */

// Critical CSS classes that should always be included
export const CRITICAL_CSS_CLASSES = [
  // Layout
  "container",
  "grid",
  "flex",
  "block",
  "inline",
  "hidden",

  // Spacing
  "p-0",
  "p-1",
  "p-2",
  "p-3",
  "p-4",
  "p-6",
  "p-8",
  "p-12",
  "m-0",
  "m-1",
  "m-2",
  "m-3",
  "m-4",
  "m-6",
  "m-8",
  "m-12",
  "mb-4",
  "mb-6",
  "mb-8",
  "mb-12",
  "mb-16",
  "mt-4",
  "mt-6",
  "mt-8",
  "mt-12",
  "mt-16",

  // Typography
  "text-4xl",
  "text-5xl",
  "text-6xl",
  "text-xl",
  "text-lg",
  "text-base",
  "text-sm",
  "font-bold",
  "font-semibold",
  "font-medium",
  "text-foreground",
  "text-muted-foreground",
  "text-primary",
  "text-secondary",

  // Colors
  "bg-primary",
  "bg-secondary",
  "bg-accent",
  "bg-muted",
  "text-white",
  "text-primary",
  "text-secondary",

  // Interactive
  "hover:opacity-90",
  "transition-opacity",
  "transition-all",
  "cursor-pointer",
  "pointer-events-none",

  // Responsive
  "md:text-6xl",
  "md:px-6",
  "md:grid-cols-4",
  "md:gap-6",
  "sm:flex-row",
  "sm:w-auto",

  // Custom
  "gradient-primary",
  "text-gradient",
];

// Component-specific CSS that can be lazy loaded
export const COMPONENT_CSS_MAP = {
  "rankings-table": [
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "border",
    "border-collapse",
    "border-spacing-0",
  ],
  "tool-detail": [
    "tabs",
    "tab-content",
    "tab-trigger",
    "card",
    "card-header",
    "card-content",
    "card-title",
  ],
  news: ["prose", "prose-lg", "prose-sm", "article", "time", "blockquote"],
};

/**
 * Generate critical CSS for above-the-fold content
 */
export function generateCriticalCSS(): string {
  return `
    /* Critical CSS for above-the-fold content */
    .container { max-width: 1280px; margin: 0 auto; padding: 0 1rem; }
    .grid { display: grid; }
    .flex { display: flex; }
    .hidden { display: none; }
    
    /* Hero section critical styles */
    .hero-section { min-height: 400px; }
    .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
    .text-6xl { font-size: 3.75rem; line-height: 1; }
    .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
    .font-bold { font-weight: 700; }
    .text-center { text-align: center; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-8 { margin-bottom: 2rem; }
    .mb-12 { margin-bottom: 3rem; }
    .gap-3 { gap: 0.75rem; }
    .gap-4 { gap: 1rem; }
    
    /* Button critical styles */
    .gradient-primary {
      background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 100%);
    }
    .text-white { color: white; }
    .px-8 { padding-left: 2rem; padding-right: 2rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    
    /* Responsive critical styles */
    @media (min-width: 768px) {
      .md\\:text-6xl { font-size: 3.75rem; line-height: 1; }
      .md\\:px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    
    @media (min-width: 640px) {
      .sm\\:flex-row { flex-direction: row; }
    }
  `;
}

/**
 * Lazy load component-specific CSS
 */
export function loadComponentCSS(component: keyof typeof COMPONENT_CSS_MAP): Promise<void> {
  return new Promise((resolve) => {
    // Check if CSS is already loaded
    const existingLink = document.querySelector(`link[data-component="${component}"]`);
    if (existingLink) {
      resolve();
      return;
    }

    // Create and inject CSS link
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/styles/components/${component}.css`;
    link.setAttribute("data-component", component);
    link.onload = () => resolve();
    link.onerror = () => resolve(); // Fail gracefully

    document.head.appendChild(link);
  });
}

/**
 * Preload critical component CSS
 */
export function preloadCriticalComponentCSS(): void {
  const criticalComponents: (keyof typeof COMPONENT_CSS_MAP)[] = [
    "rankings-table", // Usually above fold on home page
  ];

  criticalComponents.forEach((component) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "style";
    link.href = `/styles/components/${component}.css`;
    document.head.appendChild(link);
  });
}

/**
 * Remove unused CSS classes from the DOM (for development)
 */
export function auditUnusedCSS(): string[] {
  if (process.env.NODE_ENV !== "development") {
    return [];
  }

  const allElements = document.querySelectorAll("*");
  const usedClasses = new Set<string>();

  allElements.forEach((element) => {
    if (element.className && typeof element.className === "string") {
      element.className.split(" ").forEach((cls) => {
        if (cls.trim()) {
          usedClasses.add(cls.trim());
        }
      });
    }
  });

  // This is a basic implementation - in practice, you'd want to use
  // tools like PurgeCSS or UnCSS for more comprehensive analysis

  return Array.from(usedClasses);
}
