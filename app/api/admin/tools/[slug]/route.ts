/**
 * Admin edit and discontinue for one tool, addressed by slug.
 *
 * Why: #288 — the Tools Manager sent PUT and DELETE to the public
 * `/api/tools/[slug]/json`, which serves GET only, so both answered 405.
 * Writes belong behind `requireAdmin()`, not on the public route.
 * What: PUT edits the admin-editable fields; DELETE discontinues the tool by
 * setting its status to `discontinued` and keeps the row. Both check the admin
 * before reading the body or the database and answer the repository row.
 *   #453: a PUT that moves a row into `active` is refused (409) while its licence review is
 *   pending or unreadable; a row already active is unaffected.
 * Test: `tests/unit/admin-tool-edit-288.test.ts`, `tests/unit/admin-tool-licence-453.test.ts`.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { licenceActivationRefusal } from "@/lib/db/repositories/licence-review";
import { loggers } from "@/lib/logger";
// #95: typed admin metrics with write-time validation.
import { applyAdminMetrics, validateAdminMetrics } from "@/lib/admin-metrics-validation";

type RouteContext = { params: Promise<{ slug: string }> };

/** The statuses an admin may set; `redirect` and other system states are excluded. */
const EDITABLE_STATUSES = ["active", "inactive", "deprecated", "discontinued"] as const;

/**
 * Fields the admin edit accepts. Unknown keys are refused, so a client that
 * sends the whole row cannot overwrite slug, ids, scores or timestamps.
 */
const toolEditSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    status: z.enum(EDITABLE_STATUSES),
    description: z.string().trim().max(5000),
    // #95: the typed metrics object is checked by validateAdminMetrics, not zod.
    metrics: z.record(z.string(), z.unknown()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No editable field given" });

/**
 * The key `update` should look the row up by: its UUID. `findById` tries the
 * UUID column first, and a non-UUID `data.id` makes Postgres reject that query.
 */
function rowKey(tool: { id: string; db_id?: string }): string {
  return tool.db_id ?? tool.id;
}

function notFound(slug: string) {
  return NextResponse.json({ error: `Tool ${slug} not found` }, { status: 404 });
}

/** A write that found the row but returned none is a failed write, never a success. */
function writeFailed() {
  return NextResponse.json({ error: "Tool update was not applied" }, { status: 500 });
}

/** #453: an activation the licence review refuses; nothing was written. */
function activationRefused(slug: string, reason: string) {
  return NextResponse.json(
    { error: `Tool ${slug} cannot be set active: ${reason}. Nothing was written.` },
    { status: 409 }
  );
}

/**
 * PUT /api/admin/tools/[slug] — edit name, category, status, description or metrics.
 *
 * #95: `metrics` takes `{ monthly_arr, users, valuation, swe_bench: { verified } }`,
 * each `{ value, source, as_of }`. Values are stored as bare numbers in
 * `data.metrics.<field>`; provenance in `data.metrics_provenance.<field>`.
 * Any invalid field answers 400 and nothing is written.
 *
 * Answers 400 for an unreadable or invalid body, 404 for an unknown slug, and
 * `{ tool }` (the updated repository row) on success. #453: answers 409 and writes
 * nothing when `status: "active"` would activate a row whose licence review refuses it
 * (`licenceActivationRefusal`), checked on the read row and again in the UPDATE.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdmin();
  if (authResult.error) return authResult.error;

  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = toolEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid tool update", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // #95: validate every metric before any read or write; one bad field rejects the request.
  const { description, metrics: metricsInput, ...columns } = parsed.data;
  let metricEntries: ReturnType<typeof validateAdminMetrics> | null = null;
  if (metricsInput !== undefined) {
    metricEntries = validateAdminMetrics(metricsInput);
    if (!metricEntries.ok) {
      return NextResponse.json(
        { error: "Invalid tool metrics", issues: metricEntries.errors },
        { status: 400 }
      );
    }
  }

  try {
    const repo = new ToolsRepository();
    const existing = await repo.findBySlug(slug);
    if (!existing) return notFound(slug);

    // #453: no move into active while the licence review is pending; an active row stays editable (D83).
    const activating = columns.status === "active";
    if (activating && existing.status !== "active") {
      const reason = licenceActivationRefusal((existing as Record<string, unknown>)["modelSeed"]);
      if (reason) return activationRefused(slug, reason);
    }

    const updates: Record<string, unknown> = { ...columns };
    if (description !== undefined) {
      // The manager reads info.product.description first, then info.description.
      const info = (existing.info ?? {}) as Record<string, unknown>;
      const product = info["product"] as Record<string, unknown> | undefined;
      updates["info"] = {
        ...info,
        description,
        ...(product && { product: { ...product, description } }),
      };
    }
    // #95: metrics go to data.metrics (the engine's authoritative path), never data.info.
    if (metricEntries?.ok) {
      Object.assign(updates, applyAdminMetrics(existing as Record<string, unknown>, metricEntries.entries));
    }

    const tool = await repo.update(rowKey(existing), updates);
    // #453: the UPDATE's own licence guard matched nothing; the row changed after the read.
    if (!tool && activating) {
      return activationRefused(slug, "the row changed since it was read and its licence review does not allow activation");
    }
    if (!tool) return writeFailed();
    // #95: magnitude warnings are returned, not blocking.
    const warnings = metricEntries?.ok ? metricEntries.warnings : [];
    return NextResponse.json({ tool, ...(warnings.length > 0 && { warnings }) });
  } catch (error) {
    loggers.api.error("Error in admin/tools/[slug] PUT", { error, userId: authResult.userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/tools/[slug] — discontinue the tool.
 *
 * Sets status to `discontinued` and keeps the row and its history; it is not a
 * row delete (that is `DELETE /api/admin/tools?id=`). Answers 404 for an
 * unknown slug and `{ tool }` on success; repeating it is harmless.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authResult = await requireAdmin();
  if (authResult.error) return authResult.error;

  const { slug } = await context.params;

  try {
    const repo = new ToolsRepository();
    const existing = await repo.findBySlug(slug);
    if (!existing) return notFound(slug);

    const tool = await repo.update(rowKey(existing), { status: "discontinued" });
    if (!tool) return writeFailed();
    return NextResponse.json({ tool });
  } catch (error) {
    loggers.api.error("Error in admin/tools/[slug] DELETE", { error, userId: authResult.userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
