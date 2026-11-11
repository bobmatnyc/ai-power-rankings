import type { Metadata } from "next";
import { NotFoundBody } from "./not-found-body";
import { RootDocument, rootMetadata } from "./root-document";

// #443: with one root layout per top-level segment there is no `app/layout.tsx`
// to wrap `app/not-found.tsx`, so an unmatched URL renders this whole document
// (`experimental.globalNotFound`), in English as before.
export const metadata: Metadata = rootMetadata;

export default function GlobalNotFound() {
  return (
    <RootDocument lang="en">
      <NotFoundBody />
    </RootDocument>
  );
}
