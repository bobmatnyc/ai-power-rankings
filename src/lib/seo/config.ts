import { DefaultSeoProps } from "next-seo";

export const defaultSEOConfig: DefaultSeoProps = {
  titleTemplate: "%s | AI Power Rankings - Developer Tool Intelligence",
  defaultTitle: "AI Power Rankings - The Definitive Monthly Rankings of AI Coding Tools",
  description:
    "The definitive monthly rankings and analysis of agentic AI coding tools. Compare Cursor, GitHub Copilot, Claude, and 50+ AI assistants trusted by 500K+ developers.",
  canonical: "https://aipowerrankings.com",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aipowerrankings.com",
    siteName: "AI Power Rankings",
    title: "AI Power Rankings - Developer Tool Intelligence",
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by 500K+ developers worldwide.",
    images: [
      {
        url: "https://aipowerrankings.com/og-default.png",
        width: 1200,
        height: 630,
        alt: "AI Power Rankings - Developer Tool Intelligence",
        type: "image/png",
      },
    ],
  },
  twitter: {
    handle: "@aipowerrankings",
    site: "@aipowerrankings",
    cardType: "summary_large_image",
  },
  additionalLinkTags: [
    {
      rel: "icon",
      href: "/favicon.ico",
    },
    {
      rel: "apple-touch-icon",
      href: "/apple-icon.png",
    },
    {
      rel: "manifest",
      href: "/site.webmanifest",
    },
  ],
  additionalMetaTags: [
    {
      name: "author",
      content: "AI Power Rankings Team",
    },
    {
      name: "robots",
      content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
    },
    {
      name: "googlebot",
      content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
    },
    {
      name: "keywords",
      content:
        "AI coding tools, agentic AI, autonomous coding, developer tools rankings, AI assistants comparison, coding AI benchmarks, SWE-bench results, Claude vs Cursor vs GitHub Copilot",
    },
    {
      property: "og:locale:alternate",
      content: "ja_JP",
    },
    {
      property: "og:locale:alternate",
      content: "zh_CN",
    },
    {
      property: "og:locale:alternate",
      content: "es_ES",
    },
    {
      property: "og:locale:alternate",
      content: "fr_FR",
    },
    {
      property: "og:locale:alternate",
      content: "de_DE",
    },
    {
      property: "og:locale:alternate",
      content: "ko_KR",
    },
    {
      property: "og:locale:alternate",
      content: "pt_BR",
    },
  ],
};

// Language-specific SEO configurations
export const languageSEOConfig = {
  ja: {
    titleTemplate: "%s | AI Power Rankings - 開発者ツールインテリジェンス",
    defaultTitle: "AI Power Rankings - AIコーディングツールの決定的な月次ランキング",
    description:
      "エージェント型AIコーディングツールの決定的な月次ランキングと分析。50万人以上の開発者に信頼されているCursor、GitHub Copilot、Claudeなど50以上のAIアシスタントを比較。",
    openGraph: {
      locale: "ja_JP",
    },
  },
  zh: {
    titleTemplate: "%s | AI Power Rankings - 开发者工具智能",
    defaultTitle: "AI Power Rankings - AI编码工具的权威月度排名",
    description:
      "代理AI编码工具的权威月度排名和分析。比较Cursor、GitHub Copilot、Claude和50多个受50万+开发者信赖的AI助手。",
    openGraph: {
      locale: "zh_CN",
    },
  },
  es: {
    titleTemplate: "%s | AI Power Rankings - Inteligencia de Herramientas para Desarrolladores",
    defaultTitle:
      "AI Power Rankings - Rankings Mensuales Definitivos de Herramientas de Codificación AI",
    description:
      "Los rankings mensuales definitivos y análisis de herramientas de codificación AI agénticas. Compara Cursor, GitHub Copilot, Claude y más de 50 asistentes AI confiables para más de 500K desarrolladores.",
    openGraph: {
      locale: "es_ES",
    },
  },
  fr: {
    titleTemplate: "%s | AI Power Rankings - Intelligence des Outils de Développement",
    defaultTitle: "AI Power Rankings - Classements Mensuels Définitifs des Outils de Codage IA",
    description:
      "Les classements mensuels définitifs et l'analyse des outils de codage IA agentiques. Comparez Cursor, GitHub Copilot, Claude et plus de 50 assistants IA approuvés par plus de 500K développeurs.",
    openGraph: {
      locale: "fr_FR",
    },
  },
  de: {
    titleTemplate: "%s | AI Power Rankings - Entwicklerwerkzeug-Intelligenz",
    defaultTitle: "AI Power Rankings - Die definitiven monatlichen Rankings von AI-Coding-Tools",
    description:
      "Die definitiven monatlichen Rankings und Analysen von agentischen AI-Coding-Tools. Vergleichen Sie Cursor, GitHub Copilot, Claude und über 50 AI-Assistenten, denen über 500K Entwickler vertrauen.",
    openGraph: {
      locale: "de_DE",
    },
  },
  ko: {
    titleTemplate: "%s | AI Power Rankings - 개발자 도구 인텔리전스",
    defaultTitle: "AI Power Rankings - AI 코딩 도구의 최종 월간 순위",
    description:
      "에이전트 AI 코딩 도구의 최종 월간 순위 및 분석. 50만 명 이상의 개발자가 신뢰하는 Cursor, GitHub Copilot, Claude 및 50개 이상의 AI 어시스턴트 비교.",
    openGraph: {
      locale: "ko_KR",
    },
  },
  pt: {
    titleTemplate: "%s | AI Power Rankings - Inteligência de Ferramentas para Desenvolvedores",
    defaultTitle:
      "AI Power Rankings - Rankings Mensais Definitivos de Ferramentas de Codificação IA",
    description:
      "Os rankings mensais definitivos e análise de ferramentas de codificação IA agênticas. Compare Cursor, GitHub Copilot, Claude e mais de 50 assistentes IA confiáveis para mais de 500K desenvolvedores.",
    openGraph: {
      locale: "pt_BR",
    },
  },
};
