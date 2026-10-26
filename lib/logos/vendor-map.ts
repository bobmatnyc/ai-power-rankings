/**
 * Tool slug to vendor lookup, backed by `data/logos/tool-vendor.json` (L1).
 *
 * Why: a vendor mark belongs to the vendor, not the tool (two JetBrains tools share one
 *   mark), and the monogram wants the vendor's name. The map records each vendor once.
 * What: `vendorMapSchema` validates the file (kebab vendor slug, non-empty display name);
 *   `vendorForTool` returns the entry for a tool slug, or null when the vendor is not
 *   recorded (the tool then falls back to its own name).
 * Test: `tests/unit/vendor-map.test.ts`.
 */

import { z } from "zod";
import raw from "@/data/logos/tool-vendor.json";

export const vendorEntrySchema = z.object({
  vendor: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a kebab-case slug"),
  vendor_name: z.string().trim().min(1),
});
export const vendorMapSchema = z.object({
  version: z.literal(1),
  tools: z.record(z.string().min(1), vendorEntrySchema),
});
export type VendorMap = z.infer<typeof vendorMapSchema>;
export type VendorEntry = z.infer<typeof vendorEntrySchema>;

const vendorMap: VendorMap = vendorMapSchema.parse(raw);

export function vendorForTool(toolSlug: string | undefined, map: VendorMap = vendorMap): VendorEntry | null {
  return toolSlug ? (map.tools[toolSlug] ?? null) : null;
}
