import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/** The algorithm explainer card below the rankings grid (moved out of `rankings-grid.tsx`, #186). */
export function AlgorithmInfoCard({ lang, dict }: { lang: Locale; dict: Dictionary }): React.JSX.Element {
  return (
    <Card className="mt-12">
      <CardHeader>
        <CardTitle>{dict.rankings.algorithm.title}</CardTitle>
        <CardDescription>{dict.rankings.algorithm.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="factors" className="w-full">
          <TabsList>
            <TabsTrigger value="factors">{dict.rankings.algorithm.tabs.factors}</TabsTrigger>
            <TabsTrigger value="modifiers">{dict.rankings.algorithm.tabs.modifiers}</TabsTrigger>
            <TabsTrigger value="methodology">
              {dict.rankings.algorithm.tabs.methodology}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="factors" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">{dict.rankings.algorithm.primaryFactors}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.agentic}</span>
                      <span className="text-muted-foreground">30.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.innovation}</span>
                      <span className="text-muted-foreground">15.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.performance}</span>
                      <span className="text-muted-foreground">12.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.adoption}</span>
                      <span className="text-muted-foreground">10.0%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">
                    {dict.rankings.algorithm.secondaryFactors}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.traction}</span>
                      <span className="text-muted-foreground">12.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.sentiment}</span>
                      <span className="text-muted-foreground">7.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.velocity}</span>
                      <span className="text-muted-foreground">5.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{dict.rankings.algorithm.factors.resilience}</span>
                      <span className="text-muted-foreground">5.0%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modifiers" className="mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">
                  💡 {dict.home.methodology.modifiers.decay.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {dict.rankings.algorithm.modifiers.decay}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">
                  ⚠️ {dict.home.methodology.modifiers.risk.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {dict.rankings.algorithm.modifiers.risk}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">
                  💰 {dict.home.methodology.modifiers.revenue.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {dict.rankings.algorithm.modifiers.revenue}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="methodology" className="mt-4">
            <div className="prose prose-sm text-muted-foreground">
              <p>{dict.rankings.algorithm.methodologyText}</p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link href={`/${lang}/methodology`}>
                  {dict.rankings.algorithm.viewMethodology}
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
