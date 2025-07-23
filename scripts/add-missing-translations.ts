#!/usr/bin/env tsx

import * as fs from "node:fs";
import * as path from "node:path";

// Load the English reference dictionary
const enPath = path.join(process.cwd(), "src/i18n/dictionaries/en.json");
const enDict = JSON.parse(fs.readFileSync(enPath, "utf-8"));

// Define translations for tier legend
const tierLegendTranslations = {
  de: {
    title: "Ranking-Stufen",
    description: "Werkzeuge werden basierend auf ihrer Ranking-Position in Stufen eingeteilt",
    tiers: {
      S: {
        label: "Elite",
        range: "Top 5",
        description: "Die absolut besten KI-Coding-Tools",
      },
      A: {
        label: "Ausgezeichnet",
        range: "6-15",
        description: "Außergewöhnliche Tools mit starker Leistung",
      },
      B: {
        label: "Gut",
        range: "16-25",
        description: "Solide, zuverlässige Tools",
      },
      C: {
        label: "Durchschnittlich",
        range: "26-35",
        description: "Ordentliche Tools mit spezifischen Anwendungsfällen",
      },
      D: {
        label: "Unterdurchschnittlich",
        range: "36+",
        description: "Tools mit begrenzten Funktionen oder Akzeptanz",
      },
    },
  },
  fr: {
    title: "Niveaux de Classement",
    description: "Les outils sont classés par niveaux selon leur position",
    tiers: {
      S: {
        label: "Élite",
        range: "Top 5",
        description: "Les meilleurs outils de codage IA",
      },
      A: {
        label: "Excellent",
        range: "6-15",
        description: "Outils exceptionnels avec de fortes performances",
      },
      B: {
        label: "Bon",
        range: "16-25",
        description: "Outils solides et fiables",
      },
      C: {
        label: "Moyen",
        range: "26-35",
        description: "Outils corrects avec des cas d'usage spécifiques",
      },
      D: {
        label: "En Dessous de la Moyenne",
        range: "36+",
        description: "Outils avec des fonctionnalités ou une adoption limitées",
      },
    },
  },
  hr: {
    title: "Razine Rangiranja",
    description: "Alati se dodjeljuju razinama na temelju njihove pozicije rangiranja",
    tiers: {
      S: {
        label: "Elita",
        range: "Top 5",
        description: "Apsolutno najbolji AI alati za kodiranje",
      },
      A: {
        label: "Izvrsno",
        range: "6-15",
        description: "Iznimni alati s jakim performansama",
      },
      B: {
        label: "Dobro",
        range: "16-25",
        description: "Čvrsti, pouzdani alati",
      },
      C: {
        label: "Prosječno",
        range: "26-35",
        description: "Pristojni alati sa specifičnim slučajevima upotrebe",
      },
      D: {
        label: "Ispod Prosjeka",
        range: "36+",
        description: "Alati s ograničenim značajkama ili prihvaćanjem",
      },
    },
  },
  it: {
    title: "Livelli di Classifica",
    description: "Gli strumenti sono assegnati a livelli in base alla loro posizione in classifica",
    tiers: {
      S: {
        label: "Elite",
        range: "Top 5",
        description: "I migliori strumenti di codifica AI in assoluto",
      },
      A: {
        label: "Eccellente",
        range: "6-15",
        description: "Strumenti eccezionali con prestazioni elevate",
      },
      B: {
        label: "Buono",
        range: "16-25",
        description: "Strumenti solidi e affidabili",
      },
      C: {
        label: "Medio",
        range: "26-35",
        description: "Strumenti decenti con casi d'uso specifici",
      },
      D: {
        label: "Sotto la Media",
        range: "36+",
        description: "Strumenti con funzionalità o adozione limitate",
      },
    },
  },
  ja: {
    title: "ランキング階層",
    description: "ツールはランキング順位に基づいて階層に割り当てられます",
    tiers: {
      S: {
        label: "エリート",
        range: "トップ5",
        description: "最高峰のAIコーディングツール",
      },
      A: {
        label: "優秀",
        range: "6-15",
        description: "高いパフォーマンスを持つ優れたツール",
      },
      B: {
        label: "良好",
        range: "16-25",
        description: "堅実で信頼性の高いツール",
      },
      C: {
        label: "平均的",
        range: "26-35",
        description: "特定の用途に適したツール",
      },
      D: {
        label: "平均以下",
        range: "36+",
        description: "機能や採用が限定的なツール",
      },
    },
  },
  ko: {
    title: "랭킹 등급",
    description: "도구는 순위에 따라 등급이 지정됩니다",
    tiers: {
      S: {
        label: "엘리트",
        range: "상위 5개",
        description: "최고의 AI 코딩 도구",
      },
      A: {
        label: "우수",
        range: "6-15",
        description: "뛰어난 성능을 가진 탁월한 도구",
      },
      B: {
        label: "양호",
        range: "16-25",
        description: "견고하고 신뢰할 수 있는 도구",
      },
      C: {
        label: "평균",
        range: "26-35",
        description: "특정 사용 사례에 적합한 도구",
      },
      D: {
        label: "평균 이하",
        range: "36+",
        description: "기능이나 채택이 제한적인 도구",
      },
    },
  },
  uk: {
    title: "Рівні Рейтингу",
    description: "Інструменти призначаються рівням на основі їх позиції в рейтингу",
    tiers: {
      S: {
        label: "Еліта",
        range: "Топ 5",
        description: "Найкращі інструменти кодування зі штучним інтелектом",
      },
      A: {
        label: "Відмінно",
        range: "6-15",
        description: "Виняткові інструменти з високою продуктивністю",
      },
      B: {
        label: "Добре",
        range: "16-25",
        description: "Надійні та стабільні інструменти",
      },
      C: {
        label: "Середнє",
        range: "26-35",
        description: "Пристойні інструменти з конкретними випадками використання",
      },
      D: {
        label: "Нижче Середнього",
        range: "36+",
        description: "Інструменти з обмеженими функціями або прийняттям",
      },
    },
  },
  zh: {
    title: "排名等级",
    description: "工具根据其排名位置分配等级",
    tiers: {
      S: {
        label: "精英",
        range: "前5名",
        description: "最顶尖的AI编码工具",
      },
      A: {
        label: "优秀",
        range: "6-15",
        description: "性能卓越的杰出工具",
      },
      B: {
        label: "良好",
        range: "16-25",
        description: "稳定可靠的工具",
      },
      C: {
        label: "平均",
        range: "26-35",
        description: "适合特定用例的工具",
      },
      D: {
        label: "低于平均",
        range: "36+",
        description: "功能或采用度有限的工具",
      },
    },
  },
};

// Function to add missing keys to a language dictionary
function addMissingKeys(
  langCode: string,
  langDict: Record<string, unknown>,
  missingKeys: string[]
) {
  let updatedCount = 0;

  // Add tier legend translations if missing
  if (missingKeys.some((key) => key.startsWith("rankings.tierLegend"))) {
    if (!langDict.rankings) langDict.rankings = {};
    const rankings = langDict.rankings as Record<string, unknown>;
    if (!rankings.tierLegend && tierLegendTranslations[langCode]) {
      rankings.tierLegend = tierLegendTranslations[langCode];
      updatedCount++;
      console.log(`  Added tierLegend translations for ${langCode}`);
    }
  }

  // Add other missing keys from English with [TRANSLATE] marker
  for (const key of missingKeys) {
    if (key.startsWith("rankings.tierLegend")) continue; // Already handled above

    const keyParts = key.split(".");
    let enValue = enDict;

    // Navigate to the value in English dict
    for (const part of keyParts) {
      enValue = enValue?.[part];
      if (!enValue) break;
    }

    if (enValue && typeof enValue === "string") {
      // Navigate to parent in lang dict and add the missing key
      let current = langDict;
      for (let i = 0; i < keyParts.length - 1; i++) {
        if (!current[keyParts[i]]) {
          current[keyParts[i]] = {};
        }
        current = current[keyParts[i]] as Record<string, unknown>;
      }

      const lastKey = keyParts[keyParts.length - 1];
      if (!current[lastKey]) {
        current[lastKey] = `[TRANSLATE] ${enValue}`;
        updatedCount++;
      }
    }
  }

  return { dict: langDict, updatedCount };
}

// Process each language
const languages = ["de", "fr", "hr", "it", "ja", "ko", "uk", "zh"];
const reportPath = path.join(process.cwd(), "src/lib/i18n/translation-report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

for (const lang of languages) {
  console.log(`\nProcessing ${lang}...`);
  const langPath = path.join(process.cwd(), `src/i18n/dictionaries/${lang}.json`);
  const langDict = JSON.parse(fs.readFileSync(langPath, "utf-8"));

  const langReport = report.results[lang];
  if (langReport?.missingKeys && langReport.missingKeys.length > 0) {
    const { dict: updatedDict, updatedCount } = addMissingKeys(
      lang,
      langDict,
      langReport.missingKeys
    );

    if (updatedCount > 0) {
      // Write updated dictionary
      fs.writeFileSync(langPath, `${JSON.stringify(updatedDict, null, 2)}\n`);
      console.log(`  Updated ${updatedCount} keys for ${lang}`);
    } else {
      console.log(`  No updates needed for ${lang}`);
    }
  }
}

console.log("\nTranslation update complete!");
console.log("Note: Keys marked with [TRANSLATE] need proper translation.");
