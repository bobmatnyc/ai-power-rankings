---
id: T-030
title: Fix missing translations for DE, FR, HR, IT, UK languages
type: task
priority: high
status: backlog
assignee: unassigned
created: 2025-01-30
updated: 2025-01-30
epic: null
sprint: future
story_points: 8
---

# T-030: Fix missing translations for DE, FR, HR, IT, UK languages

## Summary
Fix missing translations for German (118 keys), French (118 keys), Croatian (112 keys), Italian (115 keys), and Ukrainian (112 keys) to ensure complete internationalization coverage.

## Problem Statement
Multiple languages are missing critical translations, particularly in:
- Footer sections
- Methodology documentation
- Algorithm factor descriptions
- Newsletter email flows
- About page content

This impacts user experience for non-English speakers and prevents full internationalization of the platform.

## Acceptance Criteria
- [ ] All missing translation keys added for each language
- [ ] Translation quality verified by native speakers or AI
- [ ] No console warnings for missing translations
- [ ] Footer, methodology, and algorithm sections fully translated
- [ ] Newsletter and about page sections translated
- [ ] All translations follow consistent terminology

## Technical Details

### Missing Translation Summary
| Language | Missing Keys | Completeness |
|----------|--------------|--------------|
| German   | 118          | 79.1%        |
| French   | 118          | 79.1%        |
| Croatian | 112          | 77.7%        |
| Italian  | 115          | 79.8%        |
| Ukrainian| 112          | 77.7%        |

### Key Missing Sections
1. **Footer** (`footer.*`)
   - `footer.description`
   - `footer.quickLinks`
   - `footer.categories`
   - `footer.copyright`

2. **Algorithm Factors** (`rankings.algorithm.factors.*`)
   - All factor descriptions (agentic, innovation, performance, etc.)

3. **Algorithm Modifiers** (`rankings.algorithm.modifiers.*`)
   - Decay, risk, revenue modifiers

4. **Methodology** (`methodology.*`)
   - Algorithm descriptions
   - Factor details
   - Modifier explanations
   - Data sources

5. **About Page** (`about.*`)
   - Team descriptions
   - Company information
   - Call-to-action content

6. **Newsletter** (`newsletter.*`)
   - Verification messages
   - Unsubscribe flows

### Implementation Notes
- Missing keys identified in `docs/translations/missing-translations.txt`
- Use English translations as reference in `src/i18n/dictionaries/en.json`
- Maintain JSON structure consistency across all language files
- Focus on critical UI sections first (footer, navigation)
- Consider using translation management tools or AI assistance for accuracy

## Related Files
- `/src/i18n/dictionaries/de.json`
- `/src/i18n/dictionaries/fr.json`
- `/src/i18n/dictionaries/hr.json`
- `/src/i18n/dictionaries/it.json`
- `/src/i18n/dictionaries/uk.json`
- `/docs/translations/missing-translations.txt`

## Dependencies
None - this is an independent task

## Risks
- Translation quality may vary without native speakers
- Terminology consistency across languages
- Time-consuming manual process

## Notes
- Japanese, Korean, and Chinese have extra keys beyond English - these should be reviewed for standardization
- Some languages have different structures that may need alignment
- Consider implementing automated translation checks in CI/CD