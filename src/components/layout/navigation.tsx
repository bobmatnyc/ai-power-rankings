"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrownIcon } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/rankings", label: "Rankings" },
  { href: "/news", label: "News" },
  { href: "/tools", label: "Tools" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
];

export function Navigation(): React.ReactElement {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Navigation */}
      <div className="mr-4 hidden md:flex">
        <Link href="/" className="mr-6 flex items-center space-x-3 group">
          <CrownIcon size="sm" className="w-9 h-9" />
          <div className="flex flex-col">
            <span className="font-bold text-foreground group-hover:text-primary transition-colors">
              AI <span className="text-gradient">Power Rankings</span>
            </span>
            <span className="text-xs text-muted-foreground">Discover the best AI tools</span>
          </div>
        </Link>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative px-3 py-2 transition-colors hover:text-foreground",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-foreground font-semibold"
                  : "text-foreground/60",
                pathname === item.href &&
                  "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile Navigation */}
      <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
        <div className="w-full flex-1 md:w-auto md:flex-none">
          <Link href="/" className="inline-flex md:hidden">
            <span className="font-bold">
              AI <span className="text-gradient">Power Rankings</span>
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
