-- Migration: Fold seven per-version model rows into their four family rows
-- Created: 2026-10-25
-- Description: D91 (#197) — after 0018 created glm, kimi, claude-opus and claude-sonnet
--   (inactive), this file activates them and retires the seven rows the signed #191 URL
--   table 308s to them, in ONE DO block, so a raise anywhere rolls the whole fold back.
--   Pairs, survivors first (lib/db/model-families.ts, D91_FOLD_PAIRS):
--     opus-4-6 -> claude-opus, sonnet-4-5 -> claude-sonnet, glm-5-0 -> glm,
--     kimi-2-5 -> kimi, opus-4-5 -> claude-opus, zhipu-glm-5-0 -> glm,
--     moonshot-kimi-2-5 -> kimi.
--   Steps: lock the eleven rows and every link and metrics row on them; guard the state
--   (all eleven as 0018 and 0017 left them, else raise; already folded, a no-op);
--   carry each survivor's data and scores onto its family row (data keeps the family's
--   provenance and drops autoCreated and createdByArticleId); re-point tool_links and
--   tool_metrics_history with the D90 clash rules of scripts/duplicate-tool-merge.ts
--   (planMerge): a re-point that would duplicate a (model, harness) or (tool, day) row
--   already on the family is dropped (links) or set to tool_id NULL (metrics), and between
--   two old rows the earlier pair, then the earlier row, wins; activate the four; retire
--   the seven exactly as applyMerge does (status 'redirect', data.redirect_to,
--   redirect_reason, previous_status); then count and raise on any mismatch.
--   Slugs are matched by equality only: the unrelated 'opus' row is never touched.
--   Apply with .github/workflows/apply-migration.yml, migration_file
--   0019_fold_model_families.sql, show_columns_table tools, after 0018.

DO $d91f$
DECLARE
  old_slugs constant text[] := ARRAY['opus-4-6', 'sonnet-4-5', 'glm-5-0', 'kimi-2-5', 'opus-4-5', 'zhipu-glm-5-0', 'moonshot-kimi-2-5'];
  family_of constant text[] := ARRAY['claude-opus', 'claude-sonnet', 'glm', 'kimi', 'claude-opus', 'glm', 'kimi'];
  survivor_slugs constant text[] := ARRAY['opus-4-6', 'sonnet-4-5', 'glm-5-0', 'kimi-2-5'];
  family_slugs constant text[] := ARRAY['claude-opus', 'claude-sonnet', 'glm', 'kimi'];
  fold_mark constant text := 'migration 0019_fold_model_families';
  bad text;
  done_families integer;
  done_old integer;
  old_ids uuid[];
  family_ids uuid[];
  links_total_before integer;
  links_on_old_before integer;
  metrics_total_before integer;
  metrics_on_old_before integer;
  links_dropped integer;
  links_moved integer;
  metrics_nulled integer;
  metrics_moved integer;
  carried integer;
  activated integer;
  retired integer;
  n integer;
BEGIN
  SET LOCAL lock_timeout = '5s';

  -- D91: lock the eleven rows before reading their state.
  PERFORM 1 FROM public."tools" WHERE slug = ANY (old_slugs || family_slugs) ORDER BY slug FOR UPDATE;
  SELECT array_agg(id) INTO old_ids FROM public."tools" WHERE slug = ANY (old_slugs);
  SELECT array_agg(id) INTO family_ids FROM public."tools" WHERE slug = ANY (family_slugs);
  PERFORM 1 FROM public."tool_links"
   WHERE model_tool_id = ANY (old_ids || family_ids) OR harness_tool_id = ANY (old_ids || family_ids) FOR UPDATE;
  PERFORM 1 FROM public."tool_metrics_history" WHERE tool_id = ANY (old_ids || family_ids) FOR UPDATE;

  -- D91: already folded? Then a re-run changes nothing.
  SELECT count(*)::int INTO done_families FROM public."tools"
   WHERE slug = ANY (family_slugs) AND kind = 'model' AND status = 'active' AND data->>'foldedBy' = fold_mark;
  SELECT count(*)::int INTO done_old
    FROM unnest(old_slugs, family_of) AS p(old_slug, family_slug)
    JOIN public."tools" AS t ON t.slug = p.old_slug
   WHERE t.kind = 'model' AND t.status = 'redirect'
     AND t.data->>'redirect_to' = p.family_slug AND t.data->>'redirect_reason' = 'D91: folded into ' || p.family_slug;
  IF done_families = 4 AND done_old = 7 THEN
    IF EXISTS (SELECT 1 FROM public."tool_links" WHERE model_tool_id = ANY (old_ids) OR harness_tool_id = ANY (old_ids))
       OR EXISTS (SELECT 1 FROM public."tool_metrics_history" WHERE tool_id = ANY (old_ids)) THEN
      RAISE EXCEPTION 'D91 0019: already folded, but rows point at a retired id again';
    END IF;
    RAISE NOTICE 'D91 0019: already folded, 0 rows changed';
    RETURN;
  END IF;

  -- D91: precondition — every family row inactive, every old row active, all kind model.
  SELECT string_agg(e.slug || CASE WHEN t.id IS NULL THEN ' is missing'
                                   ELSE format(' is %s/%s, expected model/%s', t.kind, t.status, e.status) END, '; ' ORDER BY e.slug)
    INTO bad
    FROM (SELECT unnest(family_slugs) AS slug, 'inactive' AS status
          UNION ALL SELECT unnest(old_slugs), 'active') AS e
    LEFT JOIN public."tools" AS t ON t.slug = e.slug
   WHERE t.id IS NULL OR t.kind <> 'model' OR t.status <> e.status;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'D91 0019: precondition failed: %', bad;
  END IF;
  -- D91: a model row on the harness side breaks the kind rule; refuse rather than move it.
  SELECT string_agg(DISTINCT t.slug, ', ') INTO bad
    FROM public."tool_links" AS l JOIN public."tools" AS t ON t.id = l.harness_tool_id
   WHERE l.harness_tool_id = ANY (old_ids || family_ids);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'D91 0019: precondition failed: tool_links name a model row on the harness side: %', bad;
  END IF;

  SELECT count(*)::int INTO links_total_before FROM public."tool_links";
  SELECT count(*)::int INTO links_on_old_before FROM public."tool_links" WHERE model_tool_id = ANY (old_ids);
  SELECT count(*)::int INTO metrics_total_before FROM public."tool_metrics_history";
  SELECT count(*)::int INTO metrics_on_old_before FROM public."tool_metrics_history" WHERE tool_id = ANY (old_ids);

  -- D91: carry the survivor's data and scores onto its family row.
  UPDATE public."tools" AS f
     SET data = (s.data - 'autoCreated' - 'createdByArticleId' - 'id' - 'slug' - 'name' - 'status')
                || f.data || jsonb_build_object('foldedBy', fold_mark, 'ruling', 'D91', 'carriedFrom', s.slug),
         baseline_score = s.baseline_score,
         delta_score = s.delta_score,
         current_score = s.current_score,
         score_updated_at = s.score_updated_at,
         updated_at = now()
    FROM unnest(survivor_slugs, family_slugs) AS p(survivor_slug, family_slug)
    JOIN public."tools" AS s ON s.slug = p.survivor_slug
   WHERE f.slug = p.family_slug;
  GET DIAGNOSTICS carried = ROW_COUNT;

  -- D91: D90 link rule — drop a re-point whose (family, harness) row exists, or that an
  -- earlier pair (then the earlier row by created_at, id) already claims.
  WITH p AS (
    SELECT o.id AS old_id, f.id AS family_id, x.ord
      FROM unnest(old_slugs, family_of) WITH ORDINALITY AS x(old_slug, family_slug, ord)
      JOIN public."tools" AS o ON o.slug = x.old_slug
      JOIN public."tools" AS f ON f.slug = x.family_slug
  ), t AS (
    SELECT l.id, p.family_id, l.harness_tool_id,
           row_number() OVER (PARTITION BY p.family_id, l.harness_tool_id ORDER BY p.ord, l.created_at, l.id) AS rn
      FROM public."tool_links" AS l JOIN p ON p.old_id = l.model_tool_id
  )
  DELETE FROM public."tool_links" AS d USING t
   WHERE d.id = t.id
     AND (t.rn > 1 OR EXISTS (
       SELECT 1 FROM public."tool_links" AS k WHERE k.model_tool_id = t.family_id AND k.harness_tool_id = t.harness_tool_id));
  GET DIAGNOSTICS links_dropped = ROW_COUNT;

  -- D91: D90 metrics rule — the same, keyed on (family, collected_date); the loser keeps
  -- its row with tool_id NULL.
  WITH p AS (
    SELECT o.id AS old_id, f.id AS family_id, x.ord
      FROM unnest(old_slugs, family_of) WITH ORDINALITY AS x(old_slug, family_slug, ord)
      JOIN public."tools" AS o ON o.slug = x.old_slug
      JOIN public."tools" AS f ON f.slug = x.family_slug
  ), t AS (
    SELECT m.id, p.family_id, m.collected_date,
           row_number() OVER (PARTITION BY p.family_id, m.collected_date ORDER BY p.ord, m.id) AS rn
      FROM public."tool_metrics_history" AS m JOIN p ON p.old_id = m.tool_id
  )
  UPDATE public."tool_metrics_history" AS u SET tool_id = NULL, updated_at = now()
    FROM t
   WHERE u.id = t.id
     AND (t.rn > 1 OR EXISTS (
       SELECT 1 FROM public."tool_metrics_history" AS k WHERE k.tool_id = t.family_id AND k.collected_date = t.collected_date));
  GET DIAGNOSTICS metrics_nulled = ROW_COUNT;

  -- D91: move every remaining link and metrics row from an old id to its family id.
  UPDATE public."tool_links" AS l SET model_tool_id = f.id, updated_at = now()
    FROM unnest(old_slugs, family_of) AS x(old_slug, family_slug)
    JOIN public."tools" AS o ON o.slug = x.old_slug
    JOIN public."tools" AS f ON f.slug = x.family_slug
   WHERE l.model_tool_id = o.id;
  GET DIAGNOSTICS links_moved = ROW_COUNT;
  UPDATE public."tool_metrics_history" AS m SET tool_id = f.id, updated_at = now()
    FROM unnest(old_slugs, family_of) AS x(old_slug, family_slug)
    JOIN public."tools" AS o ON o.slug = x.old_slug
    JOIN public."tools" AS f ON f.slug = x.family_slug
   WHERE m.tool_id = o.id;
  GET DIAGNOSTICS metrics_moved = ROW_COUNT;

  -- D91: activate the four families.
  UPDATE public."tools" SET status = 'active', updated_at = now()
   WHERE slug = ANY (family_slugs) AND status = 'inactive';
  GET DIAGNOSTICS activated = ROW_COUNT;

  -- D91: retire the seven exactly as applyMerge (scripts/duplicate-tool-merge-apply.ts) does.
  UPDATE public."tools" AS t
     SET status = 'redirect', updated_at = now(),
         data = t.data || jsonb_build_object('redirect_to', x.family_slug, 'redirect_reason', 'D91: folded into ' || x.family_slug, 'previous_status', t.status)
    FROM unnest(old_slugs, family_of) AS x(old_slug, family_slug)
   WHERE t.slug = x.old_slug AND t.status <> 'redirect';
  GET DIAGNOSTICS retired = ROW_COUNT;

  -- D91: post-count checks; any mismatch raises and rolls the fold back.
  IF carried <> 4 OR activated <> 4 OR retired <> 7 THEN
    RAISE EXCEPTION 'D91 0019: carried %, activated %, retired %; expected 4, 4, 7', carried, activated, retired;
  END IF;
  SELECT count(*)::int INTO n FROM public."tool_links" WHERE model_tool_id = ANY (old_ids) OR harness_tool_id = ANY (old_ids);
  IF n <> 0 THEN
    RAISE EXCEPTION 'D91 0019: % tool_links rows still on retired ids', n;
  END IF;
  SELECT count(*)::int INTO n FROM public."tool_metrics_history" WHERE tool_id = ANY (old_ids);
  IF n <> 0 THEN
    RAISE EXCEPTION 'D91 0019: % tool_metrics_history rows still on retired ids', n;
  END IF;
  SELECT count(*)::int INTO n FROM public."tool_links";
  IF n <> links_total_before - links_dropped OR links_moved + links_dropped <> links_on_old_before THEN
    RAISE EXCEPTION 'D91 0019: tool_links counts do not reconcile: % before, % after, % moved, % dropped, % on old ids',
      links_total_before, n, links_moved, links_dropped, links_on_old_before;
  END IF;
  SELECT count(*)::int INTO n FROM public."tool_metrics_history";
  IF n <> metrics_total_before OR metrics_moved + metrics_nulled <> metrics_on_old_before THEN
    RAISE EXCEPTION 'D91 0019: tool_metrics_history counts do not reconcile: % before, % after, % moved, % nulled, % on old ids',
      metrics_total_before, n, metrics_moved, metrics_nulled, metrics_on_old_before;
  END IF;
  SELECT count(*)::int INTO n
    FROM public."tool_links" AS l
    JOIN public."tools" AS m ON m.id = l.model_tool_id
    JOIN public."tools" AS h ON h.id = l.harness_tool_id
   WHERE l.model_tool_id = ANY (family_ids) AND (m.kind <> 'model' OR h.kind <> 'harness');
  IF n <> 0 THEN
    RAISE EXCEPTION 'D91 0019: % family links break the kind rule', n;
  END IF;
  SELECT count(*)::int INTO n FROM public."tools"
   WHERE slug = ANY (family_slugs) AND kind = 'model' AND status = 'active' AND data->>'foldedBy' = fold_mark;
  IF n <> 4 THEN
    RAISE EXCEPTION 'D91 0019: % family rows active after the fold, expected 4', n;
  END IF;
  SELECT count(*)::int INTO n
    FROM unnest(old_slugs, family_of) AS p(old_slug, family_slug)
    JOIN public."tools" AS t ON t.slug = p.old_slug
   WHERE t.status = 'redirect' AND t.data->>'redirect_to' = p.family_slug AND t.data->>'previous_status' = 'active';
  IF n <> 7 THEN
    RAISE EXCEPTION 'D91 0019: % old rows redirect to their family, expected 7', n;
  END IF;
  RAISE NOTICE 'D91 0019: folded 7 rows into 4 families; links moved %, dropped %; metrics moved %, nulled %',
    links_moved, links_dropped, metrics_moved, metrics_nulled;
END
$d91f$;
--> statement-breakpoint
