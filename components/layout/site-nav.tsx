"use client";

/**
 * The header nav (wide screens) and the phone menu.
 *
 * Why: #194 (M5-2) — the site nav moves from the sidebar into the header, with
 *   a Rankings menu whose entries are peers (D2d) and a phone menu.
 * What: `DesktopSiteNav` renders the menus from `buildSiteNav` at `xl` and up;
 *   the Rankings menu is a disclosure button. `MobileSiteNav` is a disclosure
 *   button plus a panel, shown below `xl`. Both follow the WAI-ARIA disclosure
 *   navigation pattern: `aria-expanded`/`aria-controls` on the button, Escape
 *   closes and returns focus to the button, a click outside or a route change
 *   closes. Closed panels stay in the DOM with `hidden`, so the links are in
 *   the server HTML. The current page gets `aria-current="page"`, the current
 *   section `aria-current="true"`.
 * Test: `tests/unit/site-nav-194.test.tsx`.
 */
import { ChevronDown, Home, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  buildSiteNav,
  currentSection,
  isCurrentPath,
  localizedHref,
  type NavLink,
  type NavMenu,
} from "@/lib/navigation/site-nav";
import { cn } from "@/lib/utils";

/** `aria-current` for a link: the page itself, else its section, else nothing. */
function ariaCurrent(pathname: string, href: string, inSection: boolean): "page" | "true" | undefined {
  if (isCurrentPath(pathname, href)) return "page";
  return inSection ? "true" : undefined;
}

/**
 * Open/close state for a disclosure: closes on Escape (focus back to the
 * button), on a pointer press outside `containerRef`, and on a route change.
 */
function useDisclosure(pathname: string) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A client-side navigation keeps this component mounted; close on arrival.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    },
    [open]
  );

  return { open, setOpen, containerRef, buttonRef, onKeyDown };
}

const linkBase =
  "rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const linkIdle = "text-muted-foreground hover:bg-muted hover:text-foreground";
const linkActive = "bg-primary/10 text-primary font-medium";

function RankingsMenu({
  menu,
  pathname,
  inSection,
}: {
  menu: NavMenu;
  pathname: string;
  inSection: boolean;
}) {
  const { open, setOpen, containerRef, buttonRef, onKeyDown } = useDisclosure(pathname);
  const listId = useId();

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Tabbing out of the menu closes it.
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-current={inSection ? "true" : undefined}
        onClick={() => setOpen(!open)}
        className={cn(linkBase, "flex items-center gap-1", inSection ? linkActive : linkIdle)}
      >
        {menu.label}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-1 min-w-[14rem] rounded-md border border-border bg-background p-1 shadow-lg"
      >
        {(menu.children ?? []).map((child) => (
          <li key={child.id}>
            <Link
              href={child.href}
              aria-current={ariaCurrent(pathname, child.href, false)}
              onClick={() => setOpen(false)}
              className={cn(
                linkBase,
                "block",
                isCurrentPath(pathname, child.href) ? linkActive : linkIdle
              )}
            >
              {child.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The header nav for wide screens (`xl` and up). */
export function DesktopSiteNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { dict, lang } = useI18n();
  const menus = buildSiteNav(lang, dict);
  const section = currentSection(pathname, lang);

  return (
    <nav aria-label={dict.sidebar.navigation} className={cn("hidden xl:block", className)}>
      <ul className="flex items-center gap-1">
        {menus.map((menu) => (
          <li key={menu.id}>
            {menu.children ? (
              <RankingsMenu menu={menu} pathname={pathname} inSection={section === menu.id} />
            ) : (
              <Link
                href={menu.href as string}
                aria-current={ariaCurrent(pathname, menu.href as string, section === menu.id)}
                className={cn(linkBase, "block", section === menu.id ? linkActive : linkIdle)}
              >
                {menu.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PanelLink({ link, pathname, inSection, onNavigate }: {
  link: NavLink;
  pathname: string;
  inSection: boolean;
  onNavigate: () => void;
}) {
  const current = ariaCurrent(pathname, link.href, inSection);
  return (
    <Link
      href={link.href}
      aria-current={current}
      onClick={onNavigate}
      className={cn(linkBase, "block py-3", current ? linkActive : linkIdle)}
    >
      {link.label}
    </Link>
  );
}

/** The phone menu: a button and a panel below the header, shown under `xl`. */
export function MobileSiteNav() {
  const pathname = usePathname() ?? "";
  const { dict, lang } = useI18n();
  const menus = buildSiteNav(lang, dict);
  const section = currentSection(pathname, lang);
  const { open, setOpen, containerRef, buttonRef, onKeyDown } = useDisclosure(pathname);
  const panelId = useId();
  const headingId = useId();
  const close = () => setOpen(false);
  const label = dict.sidebar.navigation;
  const home: NavLink = { id: "home", href: localizedHref(lang, ""), label: dict.navigation.home };

  return (
    <div ref={containerRef} onKeyDown={onKeyDown} className="xl:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
        <span className="sr-only">{label}</span>
      </button>
      <nav
        id={panelId}
        aria-label={label}
        hidden={!open}
        className="absolute left-0 right-0 top-full z-30 max-h-[calc(100vh-4.5rem)] overflow-y-auto border-b border-border bg-background px-4 pb-4 shadow-lg"
      >
        <ul className="space-y-1 pt-2">
          <li>
            <Link
              href={home.href}
              aria-current={isCurrentPath(pathname, home.href) ? "page" : undefined}
              onClick={close}
              className={cn(
                linkBase,
                "flex items-center gap-2 py-3",
                isCurrentPath(pathname, home.href) ? linkActive : linkIdle
              )}
            >
              <Home aria-hidden="true" className="h-4 w-4" />
              {home.label}
            </Link>
          </li>
          {menus.map((menu) =>
            menu.children ? (
              <li key={menu.id}>
                <p
                  id={headingId}
                  className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {menu.label}
                </p>
                <ul aria-labelledby={headingId} className="space-y-1">
                  {menu.children.map((child) => (
                    <li key={child.id}>
                      <PanelLink link={child} pathname={pathname} inSection={false} onNavigate={close} />
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={menu.id}>
                <PanelLink
                  link={{ id: menu.id, href: menu.href as string, label: menu.label }}
                  pathname={pathname}
                  inSection={section === menu.id}
                  onNavigate={close}
                />
              </li>
            )
          )}
        </ul>
      </nav>
    </div>
  );
}
