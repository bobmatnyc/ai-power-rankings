/**
 * Admin edit and discontinue for one tool, addressed by slug.
 *
 * Why: #288 — the Tools Manager sent PUT and DELETE to the public
 * `/api/tools/[slug]/json`, which serves GET only, so both answered 405.
 * Writes belong behind `requireAdmin()`, not on the public route.
 * What: PUT edits the admin-editable fields; DELETE discontinues the tool by
 * setting its status to `discontinued` and keeps the row. Both check the admin
 * before reading the body or the database and answer the repository row.
 * Test: `tests/unit/admin-tool-edit-288.test.ts`.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
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

/**
 * PUT /api/admin/tools/[slug] — edit name, category, status or description.
 *
 * Answers 400 for an unreadable or invalid body, 404 for an unknown slug, and
 * `{ tool }` (the updated repository row) on success.
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

    const updates: Record<string, unknown> = { ...columns };
    if (description !== undefined || metricEntries) {
      // The manager reads info.product.description first, then info.description.
      let info = (existing.info ?? {}) as Record<string, unknown>;
      if (description !== undefined) {
        const product = info["product"] as Record<string, unknown> | undefined;
        info = {
          ...info,
          description,
          ...(product && { product: { ...product, description } }),
        };
      }
      // #95: deep-merge into info.metrics; repo.update merges only shallowly.
      if (metricEntries?.ok) info = applyAdminMetrics(info, metricEntries.entries);
      updates["info"] = info;
    }

    const tool = await repo.update(rowKey(existing), updates);
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
