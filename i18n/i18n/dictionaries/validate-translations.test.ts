import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Re-enabled for #76 (bit-rotted before vitest was wired, #10).
//
// This file lives inside `i18n/i18n/`, a duplicate copy of the real `i18n/`
// tree that has existed since the initial commit but is never imported by
// any app code (verified: no `i18n/i18n` references anywhere outside this
// directory). Its own `dictionaries/*.json` are a stale snapshot (e.g. still
// say "Algorithm v7.0" where the live dictionaries say "v7.6"), so validating
// them provided no real regression protection.
//
// Fix applied: point this suite at the real, shipped dictionaries
// (`i18n/dictionaries/`) instead of the stale copy sitting next to it. The
// duplicate `i18n/i18n/` directory itself is out of scope for this test-only
// change and is flagged separately for a follow-up cleanup issue.
//
// Against the real dictionaries: all 9 locales had 0 missing keys. Only
// de.json failed the < 50 "suspicious English value" threshold (it was
// exactly 50) — a real, small translation gap (nav/sort/tab labels that
// every other locale already translates), fixed directly in de.json rather
// than by loosening this check.
const dictionariesPath = path.join(__dirname, "../../dictionaries");
const enDict = JSON.parse(fs.readFileSync(path.join(dictionariesPath, "en.json"), "utf8"));

const languageFiles = fs
  .readdirSync(dictionariesPath)
  .filter(
    (f) => f.endsWith(".json") && f !== "en.json" && !f.includes("backup") && !f.includes("test")
  );

describe("Translation Files Validation", () => {
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
                  "github", // Fix: case-insensitive so e.g. "viewGithub" is caught too
                  "website",
                  "N/A",
                  "CEO",
                  "CTO",
                  "API",
                  "SDK",
                  "FAQ",
                ];

                const isAcceptable = acceptableEnglishKeys.some((acceptable) =>
                  currentPath.some((segment) =>
                    segment.toLowerCase().includes(acceptable.toLowerCase())
                  )
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
          const value = pathArray.reduce<unknown>((obj, key) => {
            const objRecord = obj as Record<string, unknown>;
            return objRecord?.[key];
          }, langDict);
          const enValue = pathArray.reduce<unknown>((obj, key) => {
            const objRecord = obj as Record<string, unknown>;
            return objRecord?.[key];
          }, enDict);

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
