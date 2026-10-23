"use client";

import { useEffect } from "react";

/**
 * Shows hover and focus states on `/design` without a pointer or keyboard.
 *
 * Why: a state sheet and its snapshots need every state on screen at once,
 * drawn by the components' own CSS, so a sample cannot drift from the real
 * hover or focus style.
 * What: copies each loaded CSS rule that uses `:hover`, `:focus` or
 * `:focus-visible` into a rule keyed on `data-force-state`. `hover` applies to
 * the marked element and everything inside it; `focus` to the focusable
 * elements (links, buttons, fields, `[tabindex]`) at or inside it. Sets
 * `data-design-states="ready"` on `<html>` when done, which the visual test
 * waits for. Runs only on `/design`; it adds rules, never changes one.
 * Test: `tests/unit/design-page-190.test.tsx` (selector rewrite),
 * `tests/visual/design.visual.spec.ts` (rendered result).
 */

const HOVER = '[data-force-state~="hover"]';
const FOCUS = '[data-force-state~="focus"]';
const FOCUSABLE = "a, button, input, select, textarea, [tabindex]";

// A `\:` before the name is an escaped class name (`.dark\:hover\:x`), not a pseudo-class.
const REWRITES: ReadonlyArray<[RegExp, string]> = [
  [/(?<!\\):hover(?![\w-])/g, `:is(${HOVER}, ${HOVER} *)`],
  // Only focusable elements take focus, so a marked wrapper `div` shows no focus style.
  [/(?<!\\):focus(?:-visible)?(?![\w-])/g, `:is(${FOCUS}:is(${FOCUSABLE}), ${FOCUS} :is(${FOCUSABLE}))`],
];

/** The forced-state copy of a selector, or null when it has no hover or focus pseudo-class. */
export function forcedSelector(selector: string): string | null {
  const rewritten = REWRITES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), selector);
  return rewritten === selector ? null : rewritten;
}

function addForcedRules(rules: CSSRuleList, target: CSSStyleSheet | CSSGroupingRule): void {
  const additions: string[] = [];
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const selector = forcedSelector(rule.selectorText);
      if (selector) additions.push(`${selector}{${rule.style.cssText}}`);
    } else if (rule instanceof CSSGroupingRule) {
      addForcedRules(rule.cssRules, rule);
    }
  }
  for (const text of additions) {
    try {
      target.insertRule(text, target.cssRules.length);
    } catch {
      // A selector this browser rejects is skipped; the original rule is untouched.
    }
  }
}

export function ForceStates(): null {
  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.designStates === "ready") return;
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet
      }
      addForcedRules(rules, sheet);
    }
    html.dataset.designStates = "ready";
  }, []);
  return null;
}
