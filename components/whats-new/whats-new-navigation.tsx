'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, FileText } from 'lucide-react';

interface WhatsNewNavigationProps {
  lang: string;
}

export function WhatsNewNavigation({ lang }: WhatsNewNavigationProps) {
  const pathname = usePathname();

  const tabs = [
    {
      label: 'Monthly Summary',
      href: `/${lang}/whats-new`,
      icon: FileText,
      description: 'AI-generated summary of the past month'
    },
    {
      label: 'Recent (7 Days)',
      href: `/${lang}/whats-new/recent`,
      icon: Clock,
      description: 'Latest updates from the past week'
    },
  ];

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 mb-8">
      <div className="flex space-x-8">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                group py-4 px-1 border-b-2 font-medium text-sm transition-all
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              title={tab.description}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span>{tab.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
