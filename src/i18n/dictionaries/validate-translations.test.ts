import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Translation Files Validation", () => {
  const dictionariesPath = path.join(__dirname, ".");
  const enDict = JSON.parse(fs.readFileSync(path.join(dictionariesPath, "en.json"), "utf8"));

  const languageFiles = fs
    .readdirSync(dictionariesPath)
    .filter(
      (f) => f.endsWith(".json") && f !== "en.json" && !f.includes("backup") && !f.includes("test")
    );

  describe("English values in non-English files", () => {
    languageFiles.forEach((langFile) => {
      it(`${langFile} should not contain English values`, () => {
        const langDict = JSON.parse(fs.readFileSync(path.join(dictionariesPath, langFile), "utf8"));

        // Check common sections that should definitely be translated
        const criticalPaths = [
          ["common", "loading"],
          ["common", "error"],
          ["common", "tryAgain"],
          ["navigation", "home"],
          ["navigation", "rankings"],
          ["home", "hero", "title"],
        ];

        const englishValueCount: Record<string, number> = {};

        function checkForEnglishValues(
          obj: Record<string, unknown>,
          enObj: Record<string, unknown>,
          path: string[] = []
        ) {
          for (const key in obj) {
            const currentPath = [...path, key];
            const pathStr = currentPath.join(".");

            if (typeof obj[key] === "string" && typeof enObj?.[key] === "string") {
              // Check if the value is identical to English
              if (obj[key] === enObj[key]) {
                // For certain keys, English values might be acceptable
                const acceptableEnglishKeys = [
                  "appName", // AI Power Rankings is a brand name
                  "url",
                  "email",
                  "github",
                  "website",
                  "N/A",
                  "CEO",
                  "CTO",
                  "API",
                  "SDK",
                  "FAQ",
                ];

                const isAcceptable = acceptableEnglishKeys.some((acceptable) =>
                  currentPath.some((segment) => segment.includes(acceptable))
                );

                if (!isAcceptable) {
                  englishValueCount[pathStr] = (englishValueCount[pathStr] || 0) + 1;
                }
              }
            } else if (
              typeof obj[key] === "object" &&
              obj[key] !== null &&
              !Array.isArray(obj[key])
            ) {
              checkForEnglishValues(
                obj[key] as Record<string, unknown>,
                enObj?.[key] as Record<string, unknown>,
                currentPath
              );
            }
          }
        }

        checkForEnglishValues(langDict, enDict);

        // Count total English values
        const totalEnglishValues = Object.keys(englishValueCount).length;
        const suspiciousThreshold = 50; // If more than 50 keys have English values, it's suspicious

        if (totalEnglishValues > suspiciousThreshold) {
          console.error(`\n⚠️  ${langFile} has ${totalEnglishValues} English values!`);
          console.error("Sample of English values found:");
          Object.entries(englishValueCount)
            .slice(0, 10)
            .forEach(([path]) => {
              console.error(`  - ${path}`);
            });
        }

        // Check critical paths specifically
        criticalPaths.forEach((pathArray) => {
          const value = pathArray.reduce<unknown>((obj, key) => (obj as any)?.[key], langDict);
          const enValue = pathArray.reduce<unknown>((obj, key) => (obj as any)?.[key], enDict);

          if (value && enValue && value === enValue) {
            console.error(`\n❌ Critical translation missing in ${langFile}:`);
            console.error(`   Path: ${pathArray.join(".")}`);
            console.error(`   Value: "${value}" (same as English)`);
          }
        });

        expect(totalEnglishValues).toBeLessThan(suspiciousThreshold);
      });
    });
  });

  describe("Translation completeness", () => {
    languageFiles.forEach((langFile) => {
      it(`${langFile} should have all required keys`, () => {
        const langDict = JSON.parse(fs.readFileSync(path.join(dictionariesPath, langFile), "utf8"));

        function getMissingKeys(
          enObj: Record<string, unknown>,
          langObj: Record<string, unknown>,
          path: string[] = []
        ): string[] {
          const missing: string[] = [];

          for (const key in enObj) {
            const currentPath = [...path, key];
            if (!(key in langObj)) {
              missing.push(currentPath.join("."));
            } else if (
              typeof enObj[key] === "object" &&
              enObj[key] !== null &&
              !Array.isArray(enObj[key]) &&
              typeof langObj[key] === "object" &&
              langObj[key] !== null
            ) {
              missing.push(
                ...getMissingKeys(
                  enObj[key] as Record<string, unknown>,
                  langObj[key] as Record<string, unknown>,
                  currentPath
                )
              );
            }
          }

          return missing;
        }

        const missingKeys = getMissingKeys(enDict, langDict);

        if (missingKeys.length > 0) {
          console.error(`\n⚠️  ${langFile} is missing ${missingKeys.length} keys:`);
          missingKeys.slice(0, 10).forEach((key) => {
            console.error(`  - ${key}`);
          });
          if (missingKeys.length > 10) {
            console.error(`  ... and ${missingKeys.length - 10} more`);
          }
        }

        expect(missingKeys.length).toBe(0);
      });
    });
  });
});
