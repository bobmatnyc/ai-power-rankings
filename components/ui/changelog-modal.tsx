"use client";

import { ArrowRight, Bug, Calendar, GitCommit, Plus, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface ChangelogModalProps {
  children: React.ReactNode;
}

export function ChangelogModal({ children }: ChangelogModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto mx-4 sm:mx-auto w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Changelog - AI Power Ranking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Version 1.0.0 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-ds-success-fixed-mid hover:bg-ds-success-fixed">
                v1.0.0
              </Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                June 11, 2025
              </div>
              <Badge
                variant="secondary"
                className="bg-orange-100 text-orange-800 border-ds-border-tag-orange"
              >
                🎉 Major Release
              </Badge>
            </div>

            <h3 className="text-lg font-semibold">Production Ready Release</h3>
            <p className="text-muted-foreground">
              First major release with comprehensive improvements across logging, testing, database
              access, and internationalization.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-ds-success-fixed">
                  <Plus className="h-4 w-4" />
                  Added
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• Pino structured logging framework</li>
                  <li>• Vitest testing with 36 passing tests</li>
                  <li>• Semantic versioning support</li>
                  <li>• Enhanced database documentation</li>
                  <li>• Newsletter system with verification</li>
                  <li>• 8-language internationalization</li>
                  <li>• Real-time news from metrics events</li>
                  <li>• Tool company associations</li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium text-blue-700">
                  <ArrowRight className="h-4 w-4" />
                  Changed
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• Centralized database access patterns</li>
                  <li>• News from metrics_history events</li>
                  <li>• Enhanced build system workflows</li>
                  <li>• Modern responsive UI/UX</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-red-700">
                <Bug className="h-4 w-4" />
                Fixed
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Korean, Ukrainian, Croatian localization loading</li>
                <li>• Newsletter subscription RLS policies</li>
                <li>• Database connection &quot;Invalid API key&quot; errors</li>
                <li>• TypeScript errors and build failures</li>
                <li>• Production deployment issues</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Version 0.2.0 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">v0.2.0</Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                June 10, 2025
              </div>
            </div>

            <h3 className="text-lg font-semibold">Internationalization & Versioning</h3>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-ds-success-fixed">
                <Plus className="h-4 w-4" />
                Added
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Comprehensive i18n system with fallback mechanisms</li>
                <li>• Dynamic language selector for 8 languages</li>
                <li>• Translation management and missing key detection</li>
                <li>• Initial semantic versioning and cache clearing</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-red-700">
                <Bug className="h-4 w-4" />
                Fixed
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Runtime errors from missing translation keys</li>
                <li>• Mobile navigation and user experience</li>
                <li>• Vercel deployment and Next.js 15 compatibility</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Version 0.1.0 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">v0.1.0</Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                June 9, 2025
              </div>
            </div>

            <h3 className="text-lg font-semibold">Major UI Redesign</h3>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-ds-success-fixed">
                <Plus className="h-4 w-4" />
                Added
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Modern sidebar navigation with Crown branding</li>
                <li>• Newsletter system with verification flows</li>
                <li>• Dynamic news page with card layouts</li>
                <li>• Detailed tool pages with metrics history</li>
                <li>• Dynamic favicon fetching for all tools</li>
                <li>• Real-time status indicators</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Version 0.0.1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">v0.0.1</Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                June 8, 2025
              </div>
            </div>

            <h3 className="text-lg font-semibold">Initial Foundation</h3>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-ds-success-fixed">
                <Plus className="h-4 w-4" />
                Added
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                <li>• Next.js 15 with TypeScript and Tailwind CSS</li>
                <li>• Complete PostgreSQL schema with Supabase</li>
                <li>• Tool rankings and metrics tracking</li>
                <li>• Company and pricing model data</li>
                <li>• RESTful API endpoints</li>
                <li>• MCP server integration for Claude.ai</li>
                <li>• Development infrastructure and Git hooks</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4" />
              <span>Following semantic versioning</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Built with Claude Code</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
