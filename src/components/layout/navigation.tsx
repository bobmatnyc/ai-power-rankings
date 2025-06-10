"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/rankings", label: "Rankings" },
  { href: "/methodology", label: "Methodology" },
  { href: "/tools", label: "Tools" },
  { href: "/about", label: "About" },
];

export function Navigation(): React.ReactElement {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Navigation */}
      <div className="mr-4 hidden md:flex">
        <Link href="/" className="mr-6 flex items-center space-x-2 group">
          <span className="hidden font-bold sm:inline-block group-hover:text-primary transition-colors">
            AI <span className="text-gradient">Power Rankings</span>
          </span>
        </Link>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors hover:text-foreground/80",
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-foreground"
                  : "text-foreground/60"
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
            <span className="font-bold">AI <span className="text-gradient">Power Rankings</span></span>
          </Link>
        </div>
      </div>
    </>
  );
}
