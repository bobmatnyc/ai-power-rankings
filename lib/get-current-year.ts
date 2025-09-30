/**
 * Get the current year for use in SEO titles and content
 * @returns Current year as string
 */
export function getCurrentYear(): string {
  return new Date().getFullYear().toString();
}
