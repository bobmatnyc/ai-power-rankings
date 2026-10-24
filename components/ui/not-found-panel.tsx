import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

interface NotFoundPanelProps {
  title: string;
  message: string;
  children: ReactNode;
}

/**
 * The card a 404 page renders: "404", a title, a message and the page's actions.
 *
 * Why: #193: the generic and the tool not-found pages share one layout built
 * from the design-system Card and `--ds-*` tokens instead of inline styles.
 * Test: `tests/unit/tool-not-found-193.test.tsx`.
 */
export function NotFoundPanel({ title, message, children }: NotFoundPanelProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ds-surface-paper-muted p-4">
      <Card className="w-full max-w-md bg-ds-surface-paper text-center hover:translate-y-0 hover:shadow-sm">
        <CardHeader>
          <p className="text-6xl font-bold text-foreground">404</p>
          <h1 className="text-2xl font-semibold leading-tight text-foreground">{title}</h1>
          <CardDescription className="text-ds-text-paper-subtle">{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-left">{children}</CardContent>
      </Card>
    </div>
  );
}
