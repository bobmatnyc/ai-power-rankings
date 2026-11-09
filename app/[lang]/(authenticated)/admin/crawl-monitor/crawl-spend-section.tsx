"use client";

/**
 * Spend by provider (#393): a read-only section of the crawl monitor, fed by the
 * admin-only `/api/admin/crawl-monitor/spend` route. A call with no cost is shown
 * as "not priced" and its count is shown next to every sum that leaves it out.
 */

import { AlertCircle, CheckCircle, Receipt, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { type CrawlSpendSummary, type SpendBucket, spendCostText, spendDetailText } from "@/lib/crawl-monitor/spend";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function BucketCell({ bucket, unitLabel }: { bucket: SpendBucket; unitLabel: string }) {
  return (
    <TableCell className="text-right">
      <div className={bucket.costUsd === null ? "text-muted-foreground" : "font-medium"}>{spendCostText(bucket)}</div>
      <div className="text-xs text-muted-foreground">{spendDetailText(bucket, unitLabel)}</div>
    </TableCell>
  );
}

function TotalTile({ label, bucket }: { label: string; bucket: SpendBucket }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{spendCostText(bucket)}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {spendDetailText(bucket)}
        {bucket.unpricedCalls > 0 && bucket.pricedCalls > 0 && " — the sum is a floor"}
      </p>
    </div>
  );
}

export default function CrawlSpendSection({ reloadKey }: { reloadKey: number }) {
  const [spend, setSpend] = useState<CrawlSpendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/admin/crawl-monitor/spend", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: CrawlSpendSummary; error?: string };
        if (!res.ok || !body.success || !body.data) throw new Error(body.error ?? `Request failed (${res.status})`);
        if (!cancelled) setSpend(body.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load crawl spend");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" /> Spend by provider (estimated)
        </CardTitle>
        <CardDescription>
          Estimated, not billed. From the provider usage ledger: one row per paid OpenRouter, Tavily, Jina and
          Brave call. Each cost is the provider&apos;s reported cost where it gives one (OpenRouter), else billed
          units times a unit price set in the environment. A call with no price is shown as not priced and is
          left out of every sum. Days and months are UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {spend && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <TotalTile label="Today (estimated)" bucket={spend.totals.today} />
              <TotalTile label="This month (estimated)" bucket={spend.totals.month} />
              <TotalTile label="All time (estimated)" bucket={spend.totals.allTime} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead className="text-right">Today</TableHead>
                  <TableHead className="text-right">This month</TableHead>
                  <TableHead className="text-right">All time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spend.providers.map((p) => (
                  <TableRow key={p.provider}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell>
                      {p.priceConfigured === null ? (
                        <span className="text-muted-foreground">unknown provider</span>
                      ) : p.priceConfigured ? (
                        <span className="inline-flex items-center text-ds-success-fixed-mid">
                          <CheckCircle className="h-4 w-4 mr-1" /> set
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-muted-foreground">
                          <XCircle className="h-4 w-4 mr-1" /> not set
                        </span>
                      )}
                    </TableCell>
                    <BucketCell bucket={p.today} unitLabel={p.unitLabel} />
                    <BucketCell bucket={p.month} unitLabel={p.unitLabel} />
                    <BucketCell bucket={p.allTime} unitLabel={p.unitLabel} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
