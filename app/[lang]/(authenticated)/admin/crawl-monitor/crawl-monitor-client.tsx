"use client";

/**
 * Read-only crawl monitor (#325). Layout follows the tripbot crawl manager:
 * cost totals, job health, then run history. It has no write actions: the
 * only button re-reads the two GET routes.
 */

import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle, DollarSign, Loader2, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { CrawlRunView, ScoreBucket } from "@/lib/crawl-monitor/aggregate";
import type { CrawlMonitorOverview } from "@/lib/crawl-monitor/queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const usd = (n: number | null) => (n === null ? "—" : `$${n.toFixed(4)}`);
const when = (iso: string | null) => (iso ? `${iso.replace("T", " ").slice(0, 16)} UTC` : "—");
const duration = (ms: number | null) => {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">no runs</Badge>;
  if (status === "failed") return <Badge variant="destructive">{status}</Badge>;
  if (status === "running" || status === "partial") return <Badge variant="warning">{status}</Badge>;
  return <Badge variant="success">{status}</Badge>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || !body.success) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body.data as T;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function RunDetail({ run }: { run: CrawlRunView }) {
  const buckets = Object.entries(run.rejectedScoreBuckets) as Array<[ScoreBucket, number]>;
  return (
    <div className="grid gap-4 md:grid-cols-3 text-sm py-2">
      <div>
        <p className="font-medium mb-1">Candidate outcomes</p>
        {Object.keys(run.outcomeCounts).length === 0 ? (
          <p className="text-muted-foreground">None recorded</p>
        ) : (
          <ul>
            {Object.entries(run.outcomeCounts).map(([kind, n]) => (
              <li key={kind}>
                {kind.replace(/_/g, " ")}: {n}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-medium mb-1">Rejected, by average score</p>
        <ul>
          {buckets.map(([bucket, n]) => (
            <li key={bucket}>
              {bucket}: {n}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium mb-1">Errors ({run.errorCount})</p>
        {run.errors.length === 0 ? (
          <p className="text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-1">
            {run.errors.map((e, i) => (
              <li key={i} className="break-words text-muted-foreground">
                {e}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CrawlMonitorClient({ lang }: { lang: string }) {
  const [overview, setOverview] = useState<CrawlMonitorOverview | null>(null);
  const [runs, setRuns] = useState<CrawlRunView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, r] = await Promise.all([
        getJson<CrawlMonitorOverview>("/api/admin/crawl-monitor/overview"),
        getJson<CrawlRunView[]>("/api/admin/crawl-monitor/runs?limit=30"),
      ]);
      setOverview(o);
      setRuns(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load crawl monitor");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const staleJobs = overview?.jobs.filter((j) => j.stale) ?? [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/${lang}/admin`} className="inline-flex items-center text-sm text-muted-foreground mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Admin
          </Link>
          <h1 className="text-3xl font-bold">Crawl Monitor</h1>
          <p className="text-muted-foreground">Read-only view of crawl runs and estimated spend. Times are UTC.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {staleJobs.map((job) => (
        <Alert key={job.job}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {job.job} has no successful run in the last day (last success: {when(job.lastSuccessAt)}).
          </AlertDescription>
        </Alert>
      ))}

      {overview && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Tile
              label="Runs today"
              value={String(overview.runWindows.today.runs)}
              hint={`${overview.runWindows.today.failures} failed`}
            />
            <Tile
              label="Runs, last 7 days"
              value={String(overview.runWindows.last7Days.runs)}
              hint={`${overview.runWindows.last7Days.failures} failed`}
            />
            <Tile
              label="Runs, last 30 days"
              value={String(overview.runWindows.last30Days.runs)}
              hint={`${overview.runWindows.last30Days.failures} failed`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Estimated spend
              </CardTitle>
              <CardDescription>
                Estimated, not billed: the sum of each ingestion run&apos;s stored estimate. It covers the
                quality assessor and a flat per-article charge; search and reader providers are not included.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <Tile label="Today (estimated)" value={usd(overview.estimatedSpend.todayUsd)} />
              <Tile label="This month (estimated)" value={usd(overview.estimatedSpend.monthUsd)} />
              <Tile label="All time (estimated)" value={usd(overview.estimatedSpend.allTimeUsd)} />
              <Tile
                label="Latest State of AI (estimated)"
                value={usd(overview.stateOfAi.estimatedCostUsd)}
                hint={overview.stateOfAi.period ?? "none generated"}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Jobs</CardTitle>
                <CardDescription>Last run and last successful run per job.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Last status</TableHead>
                      <TableHead>Last run</TableHead>
                      <TableHead>Last success</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.jobs.map((job) => (
                      <TableRow key={job.job}>
                        <TableCell>{job.job}</TableCell>
                        <TableCell>
                          <StatusBadge status={job.lastStatus} />
                        </TableCell>
                        <TableCell>{when(job.lastRunAt)}</TableCell>
                        <TableCell>{when(job.lastSuccessAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Providers</CardTitle>
                <CardDescription>Whether each provider is configured. Values are never shown.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.providers.map((p) => (
                  <div key={p.name} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    {p.configured ? (
                      <span className="inline-flex items-center text-ds-success-fixed-mid">
                        <CheckCircle className="h-4 w-4 mr-1" /> configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-muted-foreground">
                        <XCircle className="h-4 w-4 mr-1" /> not configured
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent ingestion runs</CardTitle>
          <CardDescription>Select a row for outcome counts and errors.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Discovered</TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Ingested</TableHead>
                <TableHead className="text-right">Skipped (dup / semantic / stale)</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">Est. cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No runs recorded
                  </TableCell>
                </TableRow>
              )}
              {runs.map((run) => (
                <Fragment key={run.id}>
                  <TableRow className="cursor-pointer" onClick={() => setOpenRun(openRun === run.id ? null : run.id)}>
                    <TableCell>{when(run.startedAt)}</TableCell>
                    <TableCell>{run.runType}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell>{duration(run.durationMs)}</TableCell>
                    <TableCell className="text-right">{run.counts.discovered}</TableCell>
                    <TableCell className="text-right">{run.counts.passedQuality}</TableCell>
                    <TableCell className="text-right">{run.counts.ingested}</TableCell>
                    <TableCell className="text-right">
                      {run.counts.skipped} / {run.counts.skippedSemantic} / {run.counts.skippedStale}
                    </TableCell>
                    <TableCell className="text-right">{run.errorCount}</TableCell>
                    <TableCell className="text-right">{usd(run.estimatedCostUsd)}</TableCell>
                  </TableRow>
                  {openRun === run.id && (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <RunDetail run={run} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
