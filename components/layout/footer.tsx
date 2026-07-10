"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/client";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { lang } = useI18n();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-bold text-white mb-4">AI Power Rankings</h3>
            <p className="text-sm mb-4">
              The definitive monthly rankings and analysis of AI coding tools. Trusted by developers
              worldwide for unbiased, data-driven insights.
            </p>
            {/*
              Social links intentionally omitted: the previous Twitter/GitHub/LinkedIn
              icons all pointed at a placeholder personal blog URL. Add real, verified
              social profile links here when they exist.
            */}
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${lang}/rankings`} className="hover:text-white transition-colors">
                  Current Rankings
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/tools`} className="hover:text-white transition-colors">
                  All Tools
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/methodology`} className="hover:text-white transition-colors">
                  Methodology
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/news`} className="hover:text-white transition-colors">
                  News & Updates
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/about`} className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href={`/${lang}/best-ide-assistants`}
                  className="hover:text-white transition-colors"
                >
                  IDE Assistants
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-autonomous-agents`}
                  className="hover:text-white transition-colors"
                >
                  Autonomous Agents
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-ai-code-editors`}
                  className="hover:text-white transition-colors"
                >
                  AI Code Editors
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-ai-app-builders`}
                  className="hover:text-white transition-colors"
                >
                  AI App Builders
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-code-review-tools`}
                  className="hover:text-white transition-colors"
                >
                  Code Review Tools
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-devops-assistants`}
                  className="hover:text-white transition-colors"
                >
                  DevOps Assistants
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-testing-tools`}
                  className="hover:text-white transition-colors"
                >
                  Testing Tools
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-open-source-frameworks`}
                  className="hover:text-white transition-colors"
                >
                  Open Source Frameworks
                </Link>
              </li>
              <li>
                <Link
                  href={`/${lang}/best-ai-coding-tools`}
                  className="hover:text-white transition-colors"
                >
                  All AI Tools
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${lang}/privacy`} className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/terms`} className="hover:text-white transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/contact`} className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-gray-700" />

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center text-sm">
          <p>&copy; {currentYear} AI Power Rankings. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Built with ❤️ for the developer community</p>
        </div>
      </div>
    </footer>
  );
}
