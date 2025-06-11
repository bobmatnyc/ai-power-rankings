import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function MethodologyPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{dict.methodology.title}</h1>
        <p className="text-muted-foreground text-lg">{dict.methodology.subtitle}</p>
      </div>

      {/* Algorithm Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.methodology.algorithm.title}</CardTitle>
          <CardDescription>{dict.methodology.algorithm.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{dict.methodology.algorithm.keyFeatures}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>{dict.methodology.algorithm.features.innovationDecay}</li>
              <li>{dict.methodology.algorithm.features.platformRisk}</li>
              <li>{dict.methodology.algorithm.features.revenueQuality}</li>
              <li>{dict.methodology.algorithm.features.technicalWeighting}</li>
              <li>{dict.methodology.algorithm.features.dataValidation}</li>
              <li>{dict.methodology.algorithm.features.logarithmicScaling}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Factors */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.methodology.factors.title}</CardTitle>
          <CardDescription>{dict.methodology.factors.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Primary Factors */}
            <div>
              <h3 className="font-semibold mb-3">{dict.methodology.factors.primary}</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{dict.home.methodology.factors.agentic.name}</h4>
                      <Badge>30%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.agentic.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">
                        {dict.home.methodology.factors.innovation.name}
                      </h4>
                      <Badge>15%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.innovation.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">
                        {dict.home.methodology.factors.performance.name}
                      </h4>
                      <Badge>12.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.performance.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{dict.rankings.algorithm.factors.adoption}</h4>
                      <Badge>12.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.adoption.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{dict.home.methodology.factors.traction.name}</h4>
                      <Badge>12.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.traction.details}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Secondary Factors */}
            <div>
              <h3 className="font-semibold mb-3">{dict.methodology.factors.secondary}</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{dict.rankings.algorithm.factors.sentiment}</h4>
                      <Badge variant="secondary">7.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.sentiment.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{dict.rankings.algorithm.factors.velocity}</h4>
                      <Badge variant="secondary">5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.velocity.details}
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{dict.rankings.algorithm.factors.resilience}</h4>
                      <Badge variant="secondary">5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dict.methodology.factors.resilience.details}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modifiers */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.methodology.modifiers.title}</CardTitle>
          <CardDescription>{dict.methodology.modifiers.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">🔄 {dict.home.methodology.modifiers.decay.name}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {dict.methodology.modifiers.innovationDecay.description}
            </p>
            <div className="bg-muted p-4 rounded-md">
              <code className="text-xs">score = originalScore * e^(-0.115 * monthsOld)</code>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">⚠️ {dict.home.methodology.modifiers.risk.name}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {dict.methodology.modifiers.platformRisk.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {dict.methodology.modifiers.platformRisk.penalties}
                </h4>
                <ul className="text-xs space-y-1">
                  <li>• {dict.methodology.modifiers.platformRisk.penaltyList.acquired}: -2.0</li>
                  <li>• {dict.methodology.modifiers.platformRisk.penaltyList.exclusive}: -1.0</li>
                  <li>• {dict.methodology.modifiers.platformRisk.penaltyList.competitor}: -1.5</li>
                  <li>• {dict.methodology.modifiers.platformRisk.penaltyList.regulatory}: -0.5</li>
                  <li>• {dict.methodology.modifiers.platformRisk.penaltyList.funding}: -1.0</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {dict.methodology.modifiers.platformRisk.bonuses}
                </h4>
                <ul className="text-xs space-y-1">
                  <li>• {dict.methodology.modifiers.platformRisk.bonusList.multiLLM}: +0.5</li>
                  <li>• {dict.methodology.modifiers.platformRisk.bonusList.openSource}: +0.3</li>
                  <li>• {dict.methodology.modifiers.platformRisk.bonusList.selfHosted}: +0.3</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              💰 {dict.home.methodology.modifiers.revenue.name}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              {dict.methodology.modifiers.revenueQuality.description}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{dict.methodology.modifiers.revenueQuality.models.enterpriseHigh}</span>
                <span className="font-mono">100%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{dict.methodology.modifiers.revenueQuality.models.enterpriseStandard}</span>
                <span className="font-mono">80%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{dict.methodology.modifiers.revenueQuality.models.smbSaas}</span>
                <span className="font-mono">60%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{dict.methodology.modifiers.revenueQuality.models.consumerPremium}</span>
                <span className="font-mono">50%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{dict.methodology.modifiers.revenueQuality.models.freemium}</span>
                <span className="font-mono">30%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{dict.methodology.modifiers.revenueQuality.models.openSource}</span>
                <span className="font-mono">20%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.methodology.dataSources.title}</CardTitle>
          <CardDescription>{dict.methodology.dataSources.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{dict.methodology.dataSources.collection.title}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>{dict.methodology.dataSources.collection.sources.api}</li>
              <li>{dict.methodology.dataSources.collection.sources.research}</li>
              <li>{dict.methodology.dataSources.collection.sources.announcements}</li>
              <li>{dict.methodology.dataSources.collection.sources.community}</li>
              <li>{dict.methodology.dataSources.collection.sources.benchmarks}</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{dict.methodology.dataSources.validation.title}</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>{dict.methodology.dataSources.validation.requirements.completeness}</li>
              <li>{dict.methodology.dataSources.validation.requirements.reliability}</li>
              <li>{dict.methodology.dataSources.validation.requirements.outlier}</li>
              <li>{dict.methodology.dataSources.validation.requirements.crossValidation}</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">
              {dict.methodology.dataSources.updateFrequency.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {dict.methodology.dataSources.updateFrequency.description}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
