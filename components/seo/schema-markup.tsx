import type { Thing, WithContext } from "schema-dts";

interface SchemaMarkupProps {
  schema: WithContext<Thing> | WithContext<Thing>[];
}

export function SchemaMarkup({ schema }: SchemaMarkupProps) {
  const schemas = Array.isArray(schema) ? schema : [schema];

  return (
    <>
      {schemas.map((s, index) => (
        <script
          key={`schema-${(s as { "@type"?: string })["@type"] || index}`}
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema scripts require innerHTML for SEO
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(s),
          }}
        />
      ))}
    </>
  );
}
