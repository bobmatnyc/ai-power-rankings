import type { Metadata } from "next";
import { RootDocument, rootMetadata } from "../root-document";

// #443: the root layout for `/` (a redirect to /en); `/` has no locale, so "en".
export const metadata: Metadata = rootMetadata;

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
