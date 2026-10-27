/**
 * The group c SQL of migration 0024: news_mentions from the articles table (#313).
 *
 * Why: De4 (c) sets `news_mentions` to the site's own news corpus over the last 12 months,
 *   recomputed at apply time. The corpus is what `GET /api/news` serves: active articles, each
 *   tagged to tools by `articleToolTags`. That rule is TypeScript; this file is a line-by-line
 *   plpgsql port of it, so the migration counts exactly what the API lists.
 * What: two text blocks, `NEWS_DECLARE` (variables) and `NEWS_BODY` (statements), spliced into
 *   the 0024 DO block by `harness-inputs-sql.ts`. The port is faithful or it raises: a title
 *   neighbour character whose letter/number class is not in `t313_cls` stops the migration
 *   instead of being guessed (JS `\p{L}\p{N}` has no Postgres equivalent).
 * Test: `tests/unit/harness-inputs-news-parity-313.test.ts` (SQL against the TypeScript rule).
 */

/** Code-point ranges and their class for JS `\p{L}` (L), `\p{N}` (N) and neither (x). */
const CLASS_RANGES: ReadonlyArray<readonly [number, number, "L" | "N" | "x"]> = [
  [0, 47, "x"], [48, 57, "N"], [58, 64, "x"], [65, 90, "L"], [91, 96, "x"], [97, 122, "L"], [123, 169, "x"],
  [170, 170, "L"], [171, 177, "x"], [178, 179, "N"], [180, 180, "x"], [181, 181, "L"], [182, 184, "x"],
  [185, 185, "N"], [186, 186, "L"], [187, 187, "x"], [188, 190, "N"], [191, 191, "x"], [192, 214, "L"],
  [215, 215, "x"], [216, 246, "L"], [247, 247, "x"], [248, 591, "L"], [768, 879, "x"], [8192, 8303, "x"],
  [8352, 8399, "x"], [8592, 8959, "x"], [9472, 9727, "x"], [9728, 10101, "x"], [10132, 10175, "x"],
  [12288, 12291, "x"], [12296, 12305, "x"], [12353, 12438, "L"], [12449, 12538, "L"], [13312, 19903, "L"],
  [19968, 40869, "L"], [44032, 55203, "L"], [65024, 65039, "x"], [65281, 65295, "x"], [65306, 65312, "x"],
  [65339, 65344, "x"], [65371, 65381, "x"], [65504, 65510, "x"], [127744, 128591, "x"], [128640, 128767, "x"],
  [129280, 129535, "x"],
];

export const NEWS_DECLARE = `
  win_lo timestamptz := now() - interval '12 months';
  win_hi timestamptz := now();
  news_counts jsonb := '{}'::jsonb;
  n_articles integer := 0;
  rec_e record;
  rec_t record;
  rec_a record;
  rec_el record;
  k text;
  nm text;
  ch text;
  cp integer;
  cls text;
  j integer;
  hop integer;
  n_status text;
  n_redirect jsonb;
  n_slug text;
  n_kind text;
  ttl text;
  pos integer;
  p integer;
  q integer;
  side integer;
  hit_ok boolean;
  bad boolean;
  hit_s integer[];
  hit_e integer[];
  hit_slug text[];
  hit_kind text[];
  tm_slug text[];
  tm_kind text[];
  m_cand boolean[];
  m_rel double precision[];
  m_slug text[];
  m_kind text[];
  m_n integer;
  id_v text;
  nm_v text;
  rel_v double precision;
  res_slug text;
  res_kind text;
  p_slug text;
  p_kind text;
  top_rel double precision;
  tag_slug text[];
  tag_kind text[];
  rec_s record;
  drift text;
`;

const rangeRows = CLASS_RANGES.map(([lo, hi, cls]) => `(${lo}, ${hi}, '${cls}')`).join(", ");

export const NEWS_BODY = `
  -- #313 (group c): news_mentions = the site's news corpus over the last 12 months.
  -- Corpus rule, mirrored from the code that serves GET /api/news (origin/main 9473bea9):
  --   app/api/news/route.ts:138-148   each item's tools[] = articleToolTags(article, catalogue)
  --   app/api/news/route.ts:119-127   event date = published_date, else created_at
  --   lib/db/repositories/news.ts:184 corpus = articles with status = 'active'
  --   lib/news-tool-resolver.ts:88    buildToolCatalogue: active rows + redirects, keys, title terms
  --   lib/news-tool-resolver.ts:231   articleToolTags: primary, relevance >= 0.5 per kind, title fill
  --   lib/news-tool-resolver.ts:293   primaryArticleTool: top-relevance mention, else first title name
  --   lib/db/repositories/tools.repository.ts:57,499  catalogue rows: data.slug/name/id over columns
  -- A tool's count = active articles in the window whose tags include its slug.
  CREATE TEMP TABLE t313_cls (lo integer, hi integer, cls text) ON COMMIT DROP;
  INSERT INTO t313_cls VALUES ${rangeRows};

  CREATE TEMP TABLE t313_tool (ord integer, db_id text, id_j jsonb, slug text, name text, status text, kind text, redirect_to jsonb) ON COMMIT DROP;
  INSERT INTO t313_tool
    SELECT row_number() OVER (ORDER BY x.ctid), x.id::text, COALESCE(x.data -> 'id', to_jsonb(x.id::text)),
           COALESCE(x.data -> 'slug', to_jsonb(x.slug)) #>> '{}', COALESCE(x.data -> 'name', to_jsonb(x.name)) #>> '{}',
           x.status, x.kind, x.data -> 'redirect_to'
      FROM (SELECT t0.*, t0.ctid AS ctid FROM public."tools" AS t0) AS x
     WHERE jsonb_typeof(COALESCE(x.data -> 'slug', to_jsonb(x.slug))) = 'string'
       AND jsonb_typeof(COALESCE(x.data -> 'name', to_jsonb(x.name))) = 'string';

  CREATE TEMP TABLE t313_entry (seq serial, id_s text, db_id text, name text, slug text, target_slug text, target_kind text) ON COMMIT DROP;
  INSERT INTO t313_entry (id_s, db_id, name, slug, target_slug, target_kind)
    SELECT CASE WHEN jsonb_typeof(t.id_j) = 'string' THEN t.id_j #>> '{}' END, t.db_id, t.name, t.slug, t.slug, t.kind
      FROM t313_tool AS t WHERE t.status = 'active' ORDER BY t.ord;
  FOR rec_e IN SELECT * FROM t313_tool AS t WHERE t.status = 'redirect' ORDER BY t.ord LOOP
    n_status := rec_e.status; n_redirect := rec_e.redirect_to; n_slug := rec_e.slug; n_kind := rec_e.kind; hit_ok := false;
    FOR hop IN 0..5 LOOP
      IF n_status = 'active' THEN hit_ok := true; EXIT; END IF;
      IF n_status <> 'redirect' OR jsonb_typeof(n_redirect) <> 'string' THEN EXIT; END IF;
      SELECT t.slug, t.status, t.kind, t.redirect_to INTO n_slug, n_status, n_kind, n_redirect
        FROM t313_tool AS t WHERE t.slug = n_redirect #>> '{}' ORDER BY t.ord LIMIT 1;
      IF NOT FOUND THEN EXIT; END IF;
    END LOOP;
    IF hit_ok THEN
      INSERT INTO t313_entry (id_s, db_id, name, slug, target_slug, target_kind)
        VALUES (CASE WHEN jsonb_typeof(rec_e.id_j) = 'string' THEN rec_e.id_j #>> '{}' END, rec_e.db_id, rec_e.name, rec_e.slug, n_slug, n_kind);
    END IF;
  END LOOP;

  CREATE TEMP TABLE t313_id (k text PRIMARY KEY, target_slug text, target_kind text) ON COMMIT DROP;
  CREATE TEMP TABLE t313_key (k text PRIMARY KEY, target_slug text, target_kind text) ON COMMIT DROP;
  CREATE TEMP TABLE t313_term (seq serial, term text UNIQUE, target_slug text, target_kind text) ON COMMIT DROP;
  FOR rec_e IN SELECT * FROM t313_entry ORDER BY seq LOOP
    FOREACH k IN ARRAY ARRAY[rec_e.id_s, rec_e.db_id] LOOP
      IF k IS NOT NULL AND k <> '' THEN
        INSERT INTO t313_id VALUES (k, rec_e.target_slug, rec_e.target_kind) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY[rec_e.name, rec_e.slug] LOOP
      k := lower(regexp_replace(k, '^\\s+|\\s+$', '', 'g'));
      IF k <> '' THEN
        INSERT INTO t313_key VALUES (k, rec_e.target_slug, rec_e.target_kind) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
    -- Title terms: catalogue names as stored, never a single all-letter word (isSingleWordName).
    nm := regexp_replace(rec_e.name, '^\\s+|\\s+$', '', 'g');
    IF nm <> '' THEN
      ok := true;
      FOR j IN 1..char_length(nm) LOOP
        cp := ascii(substr(nm, j, 1));
        cls := (SELECT c.cls FROM t313_cls AS c WHERE cp BETWEEN c.lo AND c.hi);
        IF cls IS NULL THEN RAISE EXCEPTION '#313 0024: catalogue name "%" has a character (U+%) the letter/number table does not classify', nm, to_hex(cp); END IF;
        IF cls <> 'L' THEN ok := false; EXIT; END IF;
      END LOOP;
      IF NOT ok THEN
        INSERT INTO t313_term (term, target_slug, target_kind) VALUES (nm, rec_e.target_slug, rec_e.target_kind) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  FOR rec_a IN
    SELECT x.title, x.tool_mentions FROM public."articles" AS x
     WHERE x.status = 'active'
       AND COALESCE(x.published_date, x.created_at) >= win_lo AND COALESCE(x.published_date, x.created_at) <= win_hi
  LOOP
    n_articles := n_articles + 1;
    ttl := rec_a.title;
    -- matchTitle: longest terms first, first whole-word occurrence, no overlap with an earlier hit.
    hit_s := '{}'; hit_e := '{}'; hit_slug := '{}'; hit_kind := '{}';
    FOR rec_t IN SELECT * FROM t313_term ORDER BY char_length(term) DESC, seq LOOP
      pos := 1; hit_ok := false;
      LOOP
        p := strpos(substr(ttl, pos), rec_t.term);
        EXIT WHEN p = 0;
        p := p + pos - 1;
        q := p + char_length(rec_t.term);
        bad := false;
        FOR side IN 1..2 LOOP
          ch := CASE WHEN side = 1 THEN (CASE WHEN p > 1 THEN substr(ttl, p - 1, 1) END)
                     ELSE (CASE WHEN q <= char_length(ttl) THEN substr(ttl, q, 1) END) END;
          IF ch IS NOT NULL THEN
            cp := ascii(ch);
            cls := (SELECT c.cls FROM t313_cls AS c WHERE cp BETWEEN c.lo AND c.hi);
            IF cls IS NULL THEN RAISE EXCEPTION '#313 0024: title character U+% next to "%" is not classified; the corpus rule cannot be applied faithfully', to_hex(cp), rec_t.term; END IF;
            IF cls IN ('L', 'N') THEN bad := true; END IF;
          END IF;
        END LOOP;
        IF NOT bad THEN hit_ok := true; EXIT; END IF;
        pos := p + 1;
      END LOOP;
      IF hit_ok AND NOT EXISTS (SELECT 1 FROM unnest(hit_s, hit_e) AS h(s, e) WHERE p < h.e AND q > h.s) THEN
        hit_s := hit_s || p; hit_e := hit_e || q; hit_slug := hit_slug || rec_t.target_slug; hit_kind := hit_kind || rec_t.target_kind;
      END IF;
    END LOOP;
    SELECT COALESCE(array_agg(u.sl ORDER BY u.s), '{}'), COALESCE(array_agg(u.kd ORDER BY u.s), '{}') INTO tm_slug, tm_kind
      FROM unnest(hit_s, hit_slug, hit_kind) AS u(s, sl, kd);

    -- Mentions: readMention / readRelevance / resolveMention.
    m_cand := '{}'; m_rel := '{}'; m_slug := '{}'; m_kind := '{}'; m_n := 0;
    IF jsonb_typeof(rec_a.tool_mentions) = 'array' THEN
      FOR rec_el IN SELECT v.value AS value FROM jsonb_array_elements(rec_a.tool_mentions) WITH ORDINALITY AS v(value, ord) ORDER BY v.ord LOOP
        id_v := NULL; nm_v := NULL; rel_v := NULL;
        IF jsonb_typeof(rec_el.value) = 'string' THEN
          id_v := rec_el.value #>> '{}'; nm_v := id_v;
        ELSIF jsonb_typeof(rec_el.value) = 'object' THEN
          id_v := CASE WHEN jsonb_typeof(rec_el.value -> 'toolId') = 'string' THEN rec_el.value ->> 'toolId'
                       WHEN jsonb_typeof(rec_el.value -> 'tool_id') = 'string' THEN rec_el.value ->> 'tool_id' END;
          nm_v := CASE WHEN jsonb_typeof(rec_el.value -> 'name') = 'string' THEN rec_el.value ->> 'name'
                       WHEN jsonb_typeof(rec_el.value -> 'tool') = 'string' THEN rec_el.value ->> 'tool' END;
          IF jsonb_typeof(rec_el.value -> 'relevance') = 'number' THEN rel_v := (rec_el.value ->> 'relevance')::double precision; END IF;
        END IF;
        res_slug := NULL; res_kind := NULL;
        IF id_v IS NOT NULL AND id_v <> '' THEN
          SELECT i.target_slug, i.target_kind INTO res_slug, res_kind FROM t313_id AS i WHERE i.k = id_v;
        END IF;
        IF res_slug IS NULL AND nm_v IS NOT NULL AND nm_v <> '' THEN
          SELECT i.target_slug, i.target_kind INTO res_slug, res_kind FROM t313_key AS i
           WHERE i.k = lower(regexp_replace(nm_v, '^\\s+|\\s+$', '', 'g'));
        END IF;
        m_n := m_n + 1;
        m_cand := m_cand || (COALESCE(id_v, '') <> '' OR COALESCE(nm_v, '') <> '');
        m_rel := m_rel || rel_v; m_slug := m_slug || res_slug; m_kind := m_kind || res_kind;
      END LOOP;
    END IF;

    -- primaryArticleTool.
    p_slug := NULL; p_kind := NULL;
    IF NOT (true = ANY (m_cand)) THEN
      p_slug := tm_slug[1]; p_kind := tm_kind[1];
    ELSE
      top_rel := NULL;
      FOR j IN 1..m_n LOOP
        IF m_cand[j] AND (top_rel IS NULL OR COALESCE(m_rel[j], '-Infinity'::double precision) > top_rel) THEN
          top_rel := COALESCE(m_rel[j], '-Infinity'::double precision);
        END IF;
      END LOOP;
      FOR j IN 1..m_n LOOP
        IF m_cand[j] AND COALESCE(m_rel[j], '-Infinity'::double precision) = top_rel AND m_slug[j] IS NOT NULL THEN
          p_slug := m_slug[j]; p_kind := m_kind[j]; EXIT;
        END IF;
      END LOOP;
    END IF;
    CONTINUE WHEN p_slug IS NULL;

    -- articleToolTags: primary, then mentions of relevance >= 0.5 (one tag per kind), then title names.
    tag_slug := ARRAY[p_slug]; tag_kind := ARRAY[p_kind];
    FOR rec_s IN
      SELECT u.sl, u.kd FROM unnest(m_slug, m_kind, m_rel) WITH ORDINALITY AS u(sl, kd, rel, ord)
       WHERE u.rel >= 0.5 ORDER BY u.rel DESC, u.ord
    LOOP
      IF rec_s.sl IS NOT NULL AND NOT (rec_s.kd = ANY (tag_kind)) THEN tag_slug := tag_slug || rec_s.sl; tag_kind := tag_kind || rec_s.kd; END IF;
    END LOOP;
    FOR j IN 1..COALESCE(cardinality(tm_slug), 0) LOOP
      IF NOT (tm_kind[j] = ANY (tag_kind)) THEN tag_slug := tag_slug || tm_slug[j]; tag_kind := tag_kind || tm_kind[j]; END IF;
    END LOOP;
    FOREACH k IN ARRAY tag_slug LOOP
      news_counts := jsonb_set(news_counts, ARRAY[k], to_jsonb(COALESCE((news_counts ->> k)::integer, 0) + 1));
    END LOOP;
  END LOOP;
  -- An empty window means the wrong database or a failed read; writing zeros would erase the inputs.
  IF n_articles = 0 THEN RAISE EXCEPTION '#313 0024: no active article in the last 12 months; news_mentions not computed'; END IF;
`;

/** The group c post-write notice: harness tools outside the change list whose stored count differs. */
export const NEWS_DRIFT = `
  SELECT string_agg(z.slug || ' (' || z.stored || ' -> ' || z.computed || ')', ', ' ORDER BY z.slug) INTO drift
    FROM (SELECT t.slug,
                 COALESCE(t.data -> 'metrics' -> 'news_mentions', t.data -> 'info' -> 'metrics' -> 'news_mentions', '0'::jsonb)::text AS stored,
                 COALESCE((news_counts ->> t.slug)::integer, 0)::text AS computed
            FROM public."tools" AS t
           WHERE t.kind = 'harness' AND t.status = 'active'
             AND NOT EXISTS (SELECT 1 FROM t313_rows AS tr WHERE tr.slug = t.slug AND tr.compute IS NOT NULL)) AS z
   WHERE z.stored <> z.computed;
  IF drift IS NOT NULL THEN
    RAISE NOTICE '#313 0024: harness tools outside the change list whose stored news_mentions differs from the corpus count (not written): %', drift;
  END IF;
`;
