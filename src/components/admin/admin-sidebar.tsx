"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Newspaper,
  Mail,
  Users,
  Settings,
  Activity,
  FileText,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Tools", href: "/admin/tools", icon: Package },
  { name: "Rankings", href: "/admin/rankings", icon: TrendingUp },
  { name: "News", href: "/admin/news", icon: Newspaper },
  { name: "Newsletter", href: "/admin/newsletter", icon: Mail },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Activity Logs", href: "/admin/logs", icon: Activity },
  { name: "SEO", href: "/admin/seo", icon: FileText },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white shadow-sm min-h-screen">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/admin" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}