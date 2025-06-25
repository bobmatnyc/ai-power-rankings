"use client";

import { useState, useEffect } from "react";
import { ToolsContent } from "./tools-content";
import { loggers } from "@/lib/logger";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface Tool {
  id: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  description?: string | any[];
  website?: string;
  website_url?: string;
  github_url?: string;
  info?: {
    links?: {
      website?: string;
    };
  };
}

interface ToolsClientProps {
  lang: Locale;
  dict: Dictionary;
}

export default function ToolsClient({ lang, dict }: ToolsClientProps): React.JSX.Element {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true);

        // Fetch directly from the API endpoint
        const response = await fetch("/api/tools");

        if (!response.ok) {
          throw new Error(`Failed to fetch tools: ${response.status}`);
        }

        const data = await response.json();
        const toolsData = data.tools || [];

        loggers.tools.info(`Fetched ${toolsData.length} tools from API`, {
          cached: data._cached,
          cacheReason: data._cacheReason,
        });

        setTools(toolsData);
        setLoading(false);
      } catch (error) {
        loggers.tools.error("Failed to fetch tools from API", { error, lang });
        setTools([]);
        setLoading(false);
      }
    };

    fetchTools();
  }, [lang]);

  return <ToolsContent tools={tools} loading={loading} lang={lang} dict={dict} />;
}
