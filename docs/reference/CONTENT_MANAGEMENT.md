# Content Management Guide

This document explains how content is structured and updated in the AI Power Ranking project.

## Content Architecture

### Two-Layer System

1. **Source of Truth (Config Files)**
   - `config/algorithm-config.json` - Algorithm version, weights, descriptions
   - `src/content/en/methodology.md` - Detailed methodology documentation
   - `docs/ALGORITHM_CHANGELOG.md` - Version history and changes

2. **Localized Content (i18n Dictionaries)**
   - `i18n/dictionaries/en.json` - English UI text
   - `i18n/dictionaries/es.json` - Spanish UI text
   - `i18n/dictionaries/de.json` - German UI text
   - `i18n/dictionaries/ja.json` - Japanese UI text
   - `i18n/dictionaries/zh.json` - Chinese UI text
   - `i18n/dictionaries/hr.json` - Croatian UI text
   - `i18n/dictionaries/uk.json` - Ukrainian UI text
   - Plus: `fr.json`, `it.json`, `ko.json` (currently no algorithm references)

## Algorithm Version Updates

### When Algorithm Changes

**Step 1: Update Source of Truth**
1. Update `config/algorithm-config.json`:
   - Change `version` field
   - Update `description` fields
   - Modify `factors` array (weights, descriptions)
   - Add entry to `changelog` object

2. Update `docs/ALGORITHM_CHANGELOG.md`:
   - Add new version section at top
   - Document all changes and rationale
   - Update version history table
   - Update "Current Algorithm Version" footer

3. Update `src/content/en/methodology.md`:
   - Update algorithm version number in title
   - Revise factor weights and descriptions
   - Update "Last updated" date at bottom

**Step 2: Update All Language Files**

Run global search and replace across all i18n dictionary files:

```bash
# Update version numbers (example: v7.5 to v7.6)
sed -i '' 's/v7\.5/v7.6/g' i18n/dictionaries/*.json

# Verify all files updated
grep -o "v7\.[0-9]" i18n/dictionaries/*.json | sort | uniq -c
```

**Step 3: Update Descriptions (Manual)**

Each language file may need description updates in these keys:
- `home.methodology.algorithmTitle`
- `home.methodology.algorithmDescription`
- `home.footer.description`
- `footer.description`
- `rankings.subtitle`
- `rankings.algorithm.title`
- `rankings.algorithm.subtitle`
- `methodology.intro`
- `methodology.algorithm.title`
- `methodology.algorithm.description`

**Step 4: Verify Changes**

```bash
# Check English references
grep "v7\.[0-9]" i18n/dictionaries/en.json

# Check all language files
for file in es de ja zh hr uk; do
  echo "=== ${file}.json ==="
  grep "v7\.[0-9]" "i18n/dictionaries/${file}.json" | head -3
done
```

## Content Update Checklist

### Algorithm Version Update
- [ ] Update `config/algorithm-config.json` version and changelog
- [ ] Update `docs/ALGORITHM_CHANGELOG.md` with new version section
- [ ] Update `src/content/en/methodology.md` with new version
- [ ] Update version numbers in all 7 language dictionaries (en, es, de, ja, zh, hr, uk)
- [ ] Update algorithm descriptions in all language dictionaries
- [ ] Verify no old version references remain (`grep` verification)
- [ ] Test home page displays correct version
- [ ] Test methodology page displays correct information
- [ ] Check all localized versions (e.g., `/es/methodology`, `/de/methodology`)

### New Factor or Weight Change
- [ ] Update factor definition in `config/algorithm-config.json`
- [ ] Document change in `docs/ALGORITHM_CHANGELOG.md`
- [ ] Update methodology page descriptions
- [ ] Update i18n dictionary factor descriptions
- [ ] Update actual ranking algorithm code in `lib/ranking-algorithm-v7*.ts`
- [ ] Run ranking recalculation script
- [ ] Verify rankings reflect new weights

### Adding New Language Support
- [ ] Create `i18n/dictionaries/{lang}.json` from `en.json` template
- [ ] Translate all user-facing strings
- [ ] Ensure algorithm version references are current
- [ ] Update this documentation with new language code
- [ ] Test all routes with new language code (`/{lang}/...`)

## File Locations Reference

### Configuration Files
| File | Purpose | Update Frequency |
|------|---------|------------------|
| `config/algorithm-config.json` | Single source of truth for algorithm | On version changes |
| `lib/ranking-algorithm-v76.ts` | Actual ranking calculation code | On version changes |

### Documentation Files
| File | Purpose | Update Frequency |
|------|---------|------------------|
| `docs/ALGORITHM_CHANGELOG.md` | Version history tracking | On version changes |
| `docs/CONTENT_MANAGEMENT.md` | This file | As needed |
| `src/content/en/methodology.md` | Public methodology documentation | On version changes |

### i18n Dictionary Files
| File | Language | Algorithm References |
|------|----------|---------------------|
| `i18n/dictionaries/en.json` | English | 7 references |
| `i18n/dictionaries/es.json` | Spanish | 7 references |
| `i18n/dictionaries/de.json` | German | 7 references |
| `i18n/dictionaries/ja.json` | Japanese | 9 references |
| `i18n/dictionaries/zh.json` | Chinese | 9 references |
| `i18n/dictionaries/hr.json` | Croatian | 7 references |
| `i18n/dictionaries/uk.json` | Ukrainian | 7 references |
| `i18n/dictionaries/fr.json` | French | 0 references |
| `i18n/dictionaries/it.json` | Italian | 0 references |
| `i18n/dictionaries/ko.json` | Korean | 0 references |

## Common Tasks

### Find All Algorithm Version References
```bash
grep -r "v7\.[0-9]" i18n/dictionaries/ src/content/ config/
```

### Update Version Across All Files
```bash
# Update from v7.5 to v7.6 in all i18n files
for file in i18n/dictionaries/*.json; do
  sed -i '' 's/v7\.5/v7.6/g' "$file"
done
```

### Verify Consistency
```bash
# Should show only current version (v7.6)
grep -rh "Algorithm v7\.[0-9]" i18n/dictionaries/ | sort | uniq
```

### Check Translation Coverage
```bash
# Compare string counts across languages
for file in i18n/dictionaries/*.json; do
  echo "$(basename $file): $(jq 'keys | length' $file) keys"
done
```

## Best Practices

### When Updating Content

1. **Start with Source of Truth**
   - Always update `algorithm-config.json` first
   - Document changes in `ALGORITHM_CHANGELOG.md`
   - Then cascade to other files

2. **Update All Languages Together**
   - Don't leave languages with mismatched versions
   - Use search/replace for version numbers
   - Manual translation for descriptions

3. **Verify Changes**
   - Use `grep` to check all references
   - Test in browser for each language
   - Check both home and methodology pages

4. **Document Everything**
   - Update changelog with rationale
   - Note any breaking changes
   - Record date of changes

### Git Commit Messages

When updating algorithm versions:
```
feat: update algorithm to v7.6 - Market-Validated Scoring

- Increased Developer Adoption weight to 18%
- Increased Technical Performance to 18%
- Added missing data penalty system
- Updated all 7 language dictionaries

See docs/ALGORITHM_CHANGELOG.md for full details
```

### Avoiding Common Mistakes

❌ **Don't:**
- Update only English and forget other languages
- Change version in code without updating documentation
- Skip changelog entry
- Use different version numbers in different files

✅ **Do:**
- Update config first, then cascade to all files
- Verify with `grep` commands
- Test all language routes
- Document rationale for changes

## Future Enhancements

### Potential Improvements
1. **Auto-generation Script**
   - Generate i18n entries from `algorithm-config.json`
   - Reduce manual updates to translations only

2. **Validation Script**
   - Check version consistency across all files
   - Verify translation completeness
   - Warn on missing keys

3. **Content Management System**
   - UI for updating algorithm config
   - Automatic i18n propagation
   - Preview before deployment

---

*Last Updated: November 2, 2025*
*Document Version: 1.0*
