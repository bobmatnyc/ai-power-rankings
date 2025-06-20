import fs from "fs";
import path from "path";

export function loadMarkdownContent(filename: string): string {
  const filePath = path.join(process.cwd(), "src", "data", "pages", filename);
  return fs.readFileSync(filePath, "utf8");
}
