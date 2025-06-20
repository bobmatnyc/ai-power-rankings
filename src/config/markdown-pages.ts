export interface MarkdownPageConfig {
  title: string;
  description: string;
  markdownFile: string;
  noIndex?: boolean;
}

export const markdownPages: Record<string, MarkdownPageConfig> = {
  privacy: {
    title: "Privacy Policy",
    description:
      "AI Power Rankings privacy policy. Learn how we collect, use, and protect your personal information.",
    markdownFile: "privacy-policy.md",
    noIndex: false,
  },
  terms: {
    title: "Terms of Use",
    description:
      "Terms of Use for AI Power Rankings. Read our terms and conditions for using our website and services.",
    markdownFile: "terms-of-use.md",
    noIndex: false,
  },
  contact: {
    title: "Contact Us",
    description:
      "Get in touch with AI Power Rankings. Contact us for inquiries, partnerships, or to submit your AI coding tool.",
    markdownFile: "contact.md",
    noIndex: false,
  },
};
