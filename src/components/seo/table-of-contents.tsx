"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { List } from "lucide-react";

interface TOCItem {
  id: string;
  title: string;
  level: number; // 1 for h1, 2 for h2, etc.
}

interface TableOfContentsProps {
  title?: string;
  className?: string;
  containerSelector?: string; // CSS selector for the container to scan for headings
}

export function TableOfContents({
  title = "Table of Contents",
  className = "",
  containerSelector = "main",
}: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Find all headings in the specified container
    const container = document.querySelector(containerSelector);
    if (!container) {
      return;
    }

    const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const items: TOCItem[] = [];

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1));
      let id = heading.id;

      // Generate ID if it doesn't exist
      if (!id) {
        id = `heading-${index}`;
        heading.id = id;
      }

      items.push({
        id,
        title: heading.textContent || "",
        level,
      });
    });

    setTocItems(items);

    // Set up intersection observer for active section tracking
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0% -35% 0%",
        threshold: 0.1,
      }
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => {
      headings.forEach((heading) => observer.unobserve(heading));
    };
  }, [containerSelector]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  if (tocItems.length === 0) {
    return null;
  }

  return (
    <Card className={`sticky top-4 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <List className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <nav className="space-y-2">
          {tocItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToHeading(item.id)}
              className={`
                block w-full text-left text-sm transition-colors hover:text-primary
                ${item.level === 1 ? "font-semibold" : "font-normal"}
                ${item.level > 2 ? "text-muted-foreground" : ""}
                ${activeId === item.id ? "text-primary font-medium" : ""}
              `}
              style={{
                paddingLeft: `${(item.level - 1) * 16}px`,
              }}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
