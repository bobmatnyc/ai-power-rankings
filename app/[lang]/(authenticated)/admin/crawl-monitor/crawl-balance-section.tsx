"use client";

/**
 * Provider balance cross-check (#394): a read-only section of the crawl monitor,
 * fed by the admin-only `/api/admin/crawl-monitor/balances` route. A provider
 * whose figure could not be read shows "unavailable" or "not configured" and is
 * never compared, so a failed read never shows as a match.
 */

import { AlertCircle, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type BalanceCheckSummary,
  type RecordedSpend,
  agreementText,
  balanceText,
  remainingText,
} from "@/lib/crawl-monitor/balances";
import { spendCostText } from "@/lib/crawl-monitor/spend";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function recordedText(r: RecordedSpend | null): { cost: string; detail: string } {
  if (!r) return { cost: "ledger unavailable", detail: "" };
  const cost = spendCostText({ ...r, pricedCalls: r.calls - r.unpricedCalls, reportedCalls: 0 });
  const parts = [`${r.calls} call${r.calls === 1 ? "" : "s"}`];
  if (r.units !== null) parts.push(`${r.units.toLocaleString("en-US")} ${r.unitLabel}`);
  if (r.unpricedCalls > 0) parts.push(`${r.unpricedCalls} not priced`);
  return { cost, detail: parts.join(" · ") };
}

export default function CrawlBalanceSection({ reloadKey }: { reloadKey: number }) {
  const [check, setCheck] = useState<BalanceCheckSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/admin/crawl-monitor/balances", { credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: BalanceCheckSummary; error?: string };
        if (!res.ok || !body.success || !body.data) throw new Error(body.error ?? `Request failed (${res.status})`);
        if (!cancelled) setCheck(body.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load provider balances");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" /> Provider balance cross-check
        </CardTitle>
        <CardDescription>
          The ledger&apos;s spend this UTC month next to what each provider reports, read live from the
          provider&apos;s own API where it has one (OpenRouter, Tavily). Jina and Brave publish no balance API. A
          provider figure covers every use of the key, so it can be higher than the ledger. Tavily reports credits
          for its billing cycle, whose dates it does not give, so it is shown but not compared. A provider that
          cannot be read is never compared.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {check && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Ledger, this month</TableHead>
                <TableHead>Provider reports</TableHead>
                <TableHead>Cross-check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {check.providers.map((p) => {
                const recorded = recordedText(p.recorded);
                const remaining = remainingText(p.balance);
                return (
                  <TableRow key={p.provider}>
                    <TableCell>{p.label}</TableCell>
                    <TableCell className="text-right">
                      <div>{recorded.cost}</div>
                      <div className="text-xs text-muted-foreground">{recorded.detail}</div>
                    </TableCell>
                    <TableCell>
                      <div className={p.balance.state === "ok" ? "font-medium" : "text-muted-foreground"}>
                        {balanceText(p.balance)}
                      </div>
                      {remaining && <div className="text-xs text-muted-foreground">{remaining}</div>}
                    </TableCell>
                    <TableCell
                      className={
                        p.agreement.status === "differs"
                          ? "text-destructive"
                          : p.agreement.status === "agrees"
                            ? "text-ds-success-fixed-mid"
                            : "text-muted-foreground"
                      }
                    >
                      {agreementText(p.agreement)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
