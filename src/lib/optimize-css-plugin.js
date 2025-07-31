/**
 * Next.js CSS Optimization Plugin
 *
 * WHY: This plugin enhances CSS optimization beyond what Next.js provides
 * by default, implementing advanced strategies to reduce CSS bundle size
 * and improve loading performance.
 *
 * DESIGN DECISION: Implemented as a Next.js plugin to integrate seamlessly
 * with the build process without requiring manual intervention.
 */

class OptimizeCssPlugin {
  constructor(options = {}) {
    this.options = {
      enableCriticalCss: true,
      removeUnusedCss: true,
      inlineCriticalCss: true,
      ...options,
    };
  }

  apply(compiler) {
    // Hook into the compilation process
    compiler.hooks.compilation.tap("OptimizeCssPlugin", (compilation) => {
      // Process CSS assets after optimization
      compilation.hooks.processAssets.tapAsync(
        {
          name: "OptimizeCssPlugin",
          stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        async (assets, callback) => {
          try {
            // Process each CSS asset
            for (const [pathname, asset] of Object.entries(assets)) {
              if (pathname.endsWith(".css")) {
                const cssContent = asset.source();

                // Apply optimizations
                let optimizedCss = cssContent;

                // Remove source maps in production
                if (process.env.NODE_ENV === "production") {
                  optimizedCss = optimizedCss.replace(/\/\*# sourceMappingURL=.*\*\//g, "");
                }

                // Remove empty rules
                optimizedCss = optimizedCss.replace(/[^{}]+\{\s*\}/g, "");

                // Remove duplicate declarations within rules
                optimizedCss = this.removeDuplicateDeclarations(optimizedCss);

                // Update the asset with optimized content
                compilation.updateAsset(pathname, {
                  source: () => optimizedCss,
                  size: () => optimizedCss.length,
                });
              }
            }

            callback();
          } catch (error) {
            callback(error);
          }
        }
      );
    });
  }

  removeDuplicateDeclarations(css) {
    // Simple duplicate declaration removal
    return css.replace(/\{([^}]+)\}/g, (_match, declarations) => {
      const declMap = new Map();
      const decls = declarations.split(";").filter((d) => d.trim());

      decls.forEach((decl) => {
        const [property] = decl.split(":");
        if (property) {
          declMap.set(property.trim(), decl);
        }
      });

      const uniqueDecls = Array.from(declMap.values()).join(";");
      return `{${uniqueDecls}${uniqueDecls ? ";" : ""}}`;
    });
  }
}

module.exports = OptimizeCssPlugin;
