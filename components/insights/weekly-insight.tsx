import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DigestViewData } from '@/components/whats-new/weekly-digest-view';
import { digestBody, digestRange } from '@/lib/weekly-digest-window';

export interface InsightSection {
  id: string;
  title: string;
  body: string;
}

export interface InsightParts {
  /** The prose before the first `##` heading. */
  opening: string;
  /** Each `##` section in stored order: "The week in short", "What mattered", ..., "Sources". */
  sections: InsightSection[];
}

const SECTION_HEADING = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/;

function sectionId(title: string): string {
  return `insight-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * A stored digest split into the Insight template's parts.
 *
 * Why: #198: the Insight template gives each digest section its own labelled
 * region. The #181 digest is one markdown string: a code-built `# ` title, an
 * opening, the model's `##` sections and a code-built `## Sources` list.
 * What: Drops the title line (`digestBody`), returns the text before the first
 * `## ` line as `opening` and each `## ` line with the text under it as a
 * section. A short digest with no model sections yields its opening and Sources.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export function insightParts(content: string): InsightParts {
  const opening: string[] = [];
  const sections: InsightSection[] = [];
  for (const line of digestBody(content).split(/\r?\n/)) {
    const heading = SECTION_HEADING.exec(line);
    const current = sections[sections.length - 1];
    if (heading) {
      const title = heading[1] ?? '';
      sections.push({ id: sectionId(title), title, body: '' });
    } else if (current) {
      current.body += `${line}\n`;
    } else {
      opening.push(line);
    }
  }
  return {
    opening: opening.join('\n').trim(),
    sections: sections.map((s) => ({ ...s, body: s.body.trim() })),
  };
}

const PROSE =
  'prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary hover:prose-a:underline prose-p:leading-relaxed prose-li:my-1';

/** #181: no `rehype-raw`, so raw HTML in a digest renders as text, never executes. */
function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}

/**
 * The weekly Insight template (#198): one stored digest at its permalink.
 *
 * What: An `article` with a header (a "Weekly insight" eyebrow, the week range
 * as the page's only h1, the publication date in UTC), the opening as a lead,
 * then one `section` per digest section, each labelled by its h2.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export function WeeklyInsight({ digest }: { digest: DigestViewData }) {
  const published = new Date(digest.generatedAt);
  const { opening, sections } = insightParts(digest.content);
  return (
    <article className="space-y-8" data-template="insight-weekly">
      <header className="space-y-2 border-b border-ds-border-paper pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Weekly insight</p>
        <h1 className="text-3xl font-bold">{digestRange(digest.week)}</h1>
        <p className="text-sm text-muted-foreground">
          Published{' '}
          <time dateTime={published.toISOString()}>
            {published.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          </time>
        </p>
      </header>
      {opening && (
        <div className={`${PROSE} prose-p:text-base`} data-part="opening">
          <Markdown>{opening}</Markdown>
        </div>
      )}
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id} className="space-y-3">
          <h2 id={section.id} className="text-xl font-semibold">
            {section.title}
          </h2>
          <div className={PROSE}>
            <Markdown>{section.body}</Markdown>
          </div>
        </section>
      ))}
    </article>
  );
}
