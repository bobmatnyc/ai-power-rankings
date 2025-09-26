import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { RankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { loggers } from "@/lib/logger";

type Params = {
  params: Promise<{
    period: string;
  }>;
};

// GET rankings for a specific period
export async function GET(_request: NextRequest, { params }: Params) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { period } = await params;
    const rankingsRepo = new RankingsRepository();
    const periodData = await rankingsRepo.getByPeriod(period);

    if (!periodData) {
      return NextResponse.json({ error: "Rankings not found for period" }, { status: 404 });
    }

    return NextResponse.json({
      period: periodData.period,
      algorithm_version: periodData.algorithm_version,
      is_current: periodData.is_current,
      published_at: periodData.published_at,
      rankings: periodData.data?.rankings || [],
      metadata: periodData.data?.metadata || {},
      created_at: periodData.created_at,
      updated_at: periodData.updated_at,
    });
  } catch (error) {
    const { period } = await params;
    loggers.api.error("Get rankings by period error", { error, period });

    return NextResponse.json(
      {
        error: "Failed to fetch rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// UPDATE rankings for a period (save/update)
export async function PUT(request: NextRequest, { params }: Params) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { period } = await params;
    const body = await request.json();
    const rankingsRepo = new RankingsRepository();

    // Check if period exists
    const existing = await rankingsRepo.getByPeriod(period);

    if (existing) {
      // Update existing rankings
      const updated = await rankingsRepo.update(existing.id, {
        algorithm_version: body.algorithm_version || existing.algorithm_version,
        is_current: body.is_current !== undefined ? body.is_current : existing.is_current,
        published_at: body.published_at ? new Date(body.published_at) : existing.published_at,
        data: {
          rankings: body.rankings || existing.data?.rankings || [],
          metadata: body.metadata || existing.data?.metadata || {},
          generated_at: new Date().toISOString(),
        },
      });

      // If marking as current, use the setAsCurrent method
      if (body.is_current && !existing.is_current) {
        await rankingsRepo.setAsCurrent(existing.id);
      }

      return NextResponse.json({
        success: true,
        period: period,
        message: "Rankings updated successfully",
      });
    } else {
      // Create new rankings
      const created = await rankingsRepo.create({
        period: period,
        algorithm_version: body.algorithm_version || "v6.0",
        is_current: body.is_current || false,
        published_at: body.published_at ? new Date(body.published_at) : null,
        data: {
          rankings: body.rankings || [],
          metadata: body.metadata || {},
          generated_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        period: created.period,
        message: "Rankings created successfully",
      });
    }
  } catch (error) {
    const { period } = await params;
    loggers.api.error("Update rankings error", { error, period });

    return NextResponse.json(
      {
        error: "Failed to update rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE rankings for a period
export async function DELETE(_request: NextRequest, { params }: Params) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { period } = await params;
    const rankingsRepo = new RankingsRepository();

    // Check if period exists
    const existing = await rankingsRepo.getByPeriod(period);
    if (!existing) {
      return NextResponse.json({ error: "Ranking period not found" }, { status: 404 });
    }

    // Don't allow deleting the current period
    if (existing.is_current) {
      return NextResponse.json(
        { error: "Cannot delete the current ranking period" },
        { status: 400 }
      );
    }

    await rankingsRepo.deleteByPeriod(period);

    return NextResponse.json({
      success: true,
      message: "Ranking period deleted successfully",
    });
  } catch (error) {
    const { period } = await params;
    loggers.api.error("Delete rankings error", { error, period });

    return NextResponse.json(
      {
        error: "Failed to delete rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}