import { Card, CardContent } from "@/components/ui/card";
import type { LicenceNote } from "@/lib/tools/licence-notes";

/**
 * The tool page's non-commercial licence note (#184, owner ruling D88).
 *
 * Why: a reader of a listed open-weight model must see that its weights are not licensed
 *   for commercial use before relying on them.
 * What: one server-rendered section with a heading, the note sentence and an external link
 *   to the licence text. The labels come from `dict.tools.detail.licenceNote`; `{name}`,
 *   `{licence}` and `{vendor}` are filled in as literal text. `note === null` renders nothing.
 * Test: `tests/unit/licence-note-184.test.tsx`.
 */

export interface LicenceNoteLabels {
  heading: string;
  body: string;
  link: string;
}

interface LicenceNoteBlockProps {
  name: string;
  note: LicenceNote | null;
  labels: LicenceNoteLabels;
}

export function LicenceNoteBlock({ name, note, labels }: LicenceNoteBlockProps) {
  if (note === null) return null;
  // #184: function replacers, so a `$&` in a name is never read as a replacement pattern.
  const body = labels.body
    .replace("{name}", () => name)
    .replace("{licence}", () => note.licenceName)
    .replace("{vendor}", () => note.vendor);
  return (
    // Same static Card treatment as the #193 profile block.
    <Card data-licence-note className="mb-8 hover:translate-y-0 hover:shadow-sm">
      <CardContent className="p-6">
        <section aria-labelledby="tool-licence-note" className="space-y-1">
          <h2 id="tool-licence-note" className="text-lg font-semibold text-foreground">
            {labels.heading}
          </h2>
          <p className="text-foreground">{body}</p>
          <p>
            <a
              href={note.licenceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-primary hover:underline"
            >
              {labels.link}
            </a>
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
