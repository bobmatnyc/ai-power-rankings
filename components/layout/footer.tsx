"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/client";
import { buildSiteNav, currentSection, isCurrentPath } from "@/lib/navigation/site-nav";

/** A footer nav link; marks the current page (`page`) or section (`true`). */
function FooterLink({
  href,
  pathname,
  inSection = false,
  children,
}: {
  href: string;
  pathname: string;
  inSection?: boolean;
  children: ReactNode;
}) {
  const current = isCurrentPath(pathname, href) ? "page" : inSection ? "true" : undefined;
  return (
    <Link
      href={href}
      aria-current={current}
      className={current ? "text-ds-text-on-fill font-medium" : "hover:text-ds-text-on-fill transition-colors"}
    >
      {children}
    </Link>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { dict, lang } = useI18n();
  const pathname = usePathname() ?? "";
  const menus = buildSiteNav(lang, dict);
  const section = currentSection(pathname, lang);

  return (
    <footer className="bg-ds-surface-footer text-ds-text-footer">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand Section */}
          <div className="col-span-1 sm:col-span-2">
            <h3 className="text-xl font-bold text-ds-text-on-fill mb-4">AI Power Rankings</h3>
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

          {/* #194: the nav menus, from the same model as the header nav */}
          {menus.map((menu) => {
            const links = menu.children ?? [];
            return links.length > 0 ? (
              <nav key={menu.id} aria-label={menu.label}>
                <h4 className="text-lg font-semibold text-ds-text-on-fill mb-4">{menu.label}</h4>
                <ul className="space-y-2 text-sm">
                  {links.map((link) => (
                    <li key={link.id}>
                      <FooterLink href={link.href} pathname={pathname}>
                        {link.label}
                      </FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null;
          })}
          <nav aria-label={dict.common.explore}>
            <h4 className="text-lg font-semibold text-ds-text-on-fill mb-4">{dict.common.explore}</h4>
            <ul className="space-y-2 text-sm">
              {menus
                .filter((menu) => menu.href)
                .map((menu) => (
                  <li key={menu.id}>
                    <FooterLink href={menu.href as string} pathname={pathname} inSection={section === menu.id}>
                      {menu.label}
                    </FooterLink>
                  </li>
                ))}
            </ul>
          </nav>

          {/* Categories */}
          <div>
            <h4 className="text-lg font-semibold text-ds-text-on-fill mb-4">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <FooterLink href={`/${lang}/best-ide-assistants`} pathname={pathname}>
                  IDE Assistants
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-autonomous-agents`} pathname={pathname}>
                  Autonomous Agents
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-ai-code-editors`} pathname={pathname}>
                  AI Code Editors
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-ai-app-builders`} pathname={pathname}>
                  AI App Builders
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-code-review-tools`} pathname={pathname}>
                  Code Review Tools
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-devops-assistants`} pathname={pathname}>
                  DevOps Assistants
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-testing-tools`} pathname={pathname}>
                  Testing Tools
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-open-source-frameworks`} pathname={pathname}>
                  Open Source Frameworks
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/best-ai-coding-tools`} pathname={pathname}>
                  All AI Tools
                </FooterLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-lg font-semibold text-ds-text-on-fill mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <FooterLink href={`/${lang}/privacy`} pathname={pathname}>
                  Privacy Policy
                </FooterLink>
              </li>
              <li>
                <FooterLink href={`/${lang}/terms`} pathname={pathname}>
                  Terms of Use
                </FooterLink>
              </li>
              <li>
                {/* #191: the final URL; /{lang}/contact 308s here. */}
                <FooterLink href={`/${lang}/contact/default`} pathname={pathname}>
                  Contact Us
                </FooterLink>
              </li>
              <li>
                {/* #194: a route handler, so a plain <a>, not next/link. */}
                <a href={`/${lang}/news/rss.xml`} className="hover:text-ds-text-on-fill transition-colors">
                  RSS
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-ds-border-footer" />

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center text-sm">
          <p>&copy; {currentYear} AI Power Rankings. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Built with ❤️ for the developer community</p>
        </div>
      </div>
    </footer>
  );
}
