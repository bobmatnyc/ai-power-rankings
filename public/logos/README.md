# Vendor logos

Vendor marks live here, one file per mark, and only when `data/logos/manifest.json` records
the source, the terms and the SHA-256 of the file. A vendor whose terms forbid the mark has
a `monogram` entry and no file. A `reference-only` file lives in `data/logos/reference/`, never
under `public/`, because everything in `public/` is served. `npm run lint:logos` fails on a file
with no entry, a missing file, a hash mismatch, an empty provenance field, a `monogram` entry that
ships a file, or a `reference-only` file under `public/`.

The legacy `public/tool-icons/` PNGs are not covered by this directory or its lint (see D82).
