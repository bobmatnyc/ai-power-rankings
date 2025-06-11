"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code2, Database, Globe, Zap, Shield, Gauge } from "lucide-react";

interface TechStackModalProps {
  children: React.ReactNode;
}

export function TechStackModal({ children }: TechStackModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto mx-4 sm:mx-auto w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Technical Stack - AI Power Ranking
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">88</div>
              <div className="text-sm text-muted-foreground">Source Files</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">12k</div>
              <div className="text-sm text-muted-foreground">Lines of Code</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-muted-foreground">Languages</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">2</div>
              <div className="text-sm text-muted-foreground">Days to Build</div>
            </div>
          </div>

          <Separator />

          {/* Frontend Stack */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Frontend Stack
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Next.js 15.3</span>
                <Badge variant="secondary">App Router</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">React 19</span>
                <Badge variant="secondary">Latest</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">TypeScript 5</span>
                <Badge variant="secondary">Strict Mode</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Tailwind CSS</span>
                <Badge variant="secondary">v3.4</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Backend Stack */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backend & Database
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Supabase</span>
                <Badge variant="secondary">PostgreSQL</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Database Tables</span>
                <Badge variant="secondary">8 Custom</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">API Routes</span>
                <Badge variant="secondary">13 Endpoints</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Email Service</span>
                <Badge variant="secondary">Resend</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Performance */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Performance
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Lighthouse Score</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  95+
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Build Time</span>
                <Badge variant="secondary">~30s</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Page Load</span>
                <Badge variant="secondary">&lt;1s cached</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">API Response</span>
                <Badge variant="secondary">&lt;100ms avg</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Security */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Testing
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Testing Framework</span>
                <Badge variant="secondary">Vitest (36 tests)</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Type Safety</span>
                <Badge variant="secondary">100% TypeScript</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">CAPTCHA</span>
                <Badge variant="secondary">Cloudflare Turnstile</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Logging</span>
                <Badge variant="secondary">Pino (Structured)</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Key Features */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Key Features
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • <strong>Ranking Algorithm v6.0</strong> - 8 factors with dynamic modifiers
              </li>
              <li>
                • <strong>Real-time News</strong> - Pulls from metrics_history events
              </li>
              <li>
                • <strong>Internationalization</strong> - 8 languages with SSR
              </li>
              <li>
                • <strong>Newsletter System</strong> - Double opt-in with Resend
              </li>
              <li>
                • <strong>Static Generation</strong> - SSG with ISR for performance
              </li>
            </ul>
          </div>

          <Separator />

          {/* Philosophy */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm italic text-center">
              &quot;Ship fast, iterate faster&quot; - Built in 2 days by one developer
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
