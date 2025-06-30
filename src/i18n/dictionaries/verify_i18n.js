const fs = require("fs");

const en = JSON.parse(fs.readFileSync("en.json", "utf8"));
const languageFiles = fs
  .readdirSync(".")
  .filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "en.json" &&
      !f.includes("batch") &&
      !f.includes("backup") &&
      !f.includes("translate")
  );

function getAllKeys(obj, prefix = "") {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => current && current[key], obj);
}

const allEnglishKeys = getAllKeys(en);
console.log(`📊 Reference keys: ${allEnglishKeys.length}`);

languageFiles.forEach((langFile) => {
  const langCode = langFile.replace(".json", "");
  const langData = JSON.parse(fs.readFileSync(langFile, "utf8"));
  const langKeys = getAllKeys(langData);
  const missingKeys = allEnglishKeys.filter((key) => !getNestedValue(langData, key));
  const completeness = (
    ((allEnglishKeys.length - missingKeys.length) / allEnglishKeys.length) *
    100
  ).toFixed(1);

  console.log(
    `${langCode.toUpperCase()}: ${completeness}% complete, ${missingKeys.length} missing`
  );
  if (missingKeys.length > 0) {
    console.log(`Missing: ${missingKeys.slice(0, 5).join(", ")}`);
  }
});
