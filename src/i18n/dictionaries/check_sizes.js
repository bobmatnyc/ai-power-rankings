const fs = require("fs");

const files = fs
  .readdirSync(".")
  .filter(
    (f) =>
      f.endsWith(".json") &&
      !f.includes("batch") &&
      !f.includes("backup") &&
      !f.includes("translate") &&
      !f.includes("project_summary")
  );
const sizes = files.map((f) => ({
  file: f,
  size: fs.statSync(f).size,
  lines: fs.readFileSync(f, "utf8").split("\n").length,
}));

const avgSize = sizes.reduce((sum, s) => sum + s.size, 0) / sizes.length;

console.log("File size analysis:");
sizes.forEach((s) => {
  const deviation = (((s.size - avgSize) / avgSize) * 100).toFixed(1);
  const flag = Math.abs(deviation) > 20 ? "🔴" : Math.abs(deviation) > 10 ? "🟡" : "✅";
  console.log(`${flag} ${s.file}: ${s.size}b (${deviation}%) ${s.lines} lines`);
});
