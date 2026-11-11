import type { Metadata } from "next";
import { RootDocument, rootMetadata } from "../root-document";

// #443: `/design` is its own root layout now that `app/layout.tsx` is gone; the sheet is English.
export const metadata: Metadata = rootMetadata;

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
