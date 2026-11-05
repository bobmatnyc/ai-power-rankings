import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { digestBody } from '@/lib/weekly-digest-window';

/**
 * The body of the Insight template, shared by the weekly and monthly pages (#198).
 *
 * Why: #198: proposal M5-7 names one Insight template for both cadences. Both
 * stored shapes (#181 weekly digest, #182 monthly report) are one markdown
 * string: a `# ` title line, an opening and `##` sections.
 */

export interface InsightSection {
  id: string;
  title: string;
  body: string;
}

export interface InsightParts {
  /** The prose before the first `##` heading. */
  opening: string;
  /** Each `##` section in stored order. */
  sections: InsightSection[];
}

const SECTION_HEADING = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/;

function sectionId(title: string): string {
  return `insight-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * Stored Insight markdown split into the template's parts.
 *
 * Why: #198: the Insight template gives each section its own labelled region.
 * What: Drops a leading `# ` title line (`digestBody`), returns the text before
 * the first `## ` line as `opening` and each `## ` line with the text under it
 * as a section. Text with no `## ` line is all opening.
 * Test: `tests/unit/insights-weekly-198.test.tsx`, `tests/unit/insights-monthly-198.test.tsx`.
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

/** #181: no `rehype-raw`, so raw HTML in stored markdown renders as text, never executes. */
function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}

/** The publication date line of an Insight header, formatted in UTC. */
export function InsightPublished({ date }: { date: Date | string }) {
  const published = new Date(date);
  return (
    <p className="text-sm text-muted-foreground">
      Published{' '}
      <time dateTime={published.toISOString()}>
        {published.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
      </time>
    </p>
  );
}

/**
 * The opening as a lead, then one `section` per `##` section, each labelled by its h2 (#198).
 *
 * Test: `tests/unit/insights-weekly-198.test.tsx`, `tests/unit/insights-monthly-198.test.tsx`.
 */
export function InsightBody({ content }: { content: string }) {
  const { opening, sections } = insightParts(content);
  return (
    <>
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
    </>
  );
}
