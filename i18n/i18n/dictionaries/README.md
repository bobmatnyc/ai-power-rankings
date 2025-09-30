# i18n Dictionary Files

This directory contains translation files for the AI Power Rankings application.

## Structure Synchronization

The `sync_structure.js` script helps maintain consistent structure across all language files:

### Features

- **Automatic backups** - Creates timestamped backups before making changes
- **Translation preservation** - Never overwrites existing translations
- **New key marking** - Marks new untranslated keys with `[TRANSLATE]` prefix
- **Validation** - Warns if more than 50% of values are in English (indicates corruption)

### Usage

```bash
cd src/i18n/dictionaries
node sync_structure.js
```

### Translation Validation Tests

```bash
npm run test:i18n
vitest run src/i18n/dictionaries/validate-translations.test.ts
```

### Pre-commit Protection

The project now has pre-commit hooks that:

1. Test i18n imports when middleware.ts or auth.ts change
2. Validate translation files when any dictionary JSON is modified

### Recovery from Corruption

If translation files get corrupted again:

1. Check git history for the last good commit:

   ```bash
   git log --oneline -- src/i18n/dictionaries/*.json
   ```

2. Restore from a specific commit (e.g., `2176daa`):
   ```bash
   git checkout 2176daa -- src/i18n/dictionaries/de.json src/i18n/dictionaries/fr.json # etc...
   ```

### Adding New Translations

When adding new keys:

1. Add them to `en.json` first
2. Run `node sync_structure_safe.js` to sync structure
3. Look for `[TRANSLATE]` markers in other language files
4. Replace markers with proper translations

### File Structure

- `en.json` - Source of truth for structure
- `[lang].json` - Translated content for each language
- `*.test.ts` - Validation tests
- `sync_structure.js` - Safe sync script with validation
