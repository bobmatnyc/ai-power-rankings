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
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
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

      {/* Innovation Scoring Framework */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Innovation Scoring Framework</CardTitle>
          <CardDescription>
            Our innovation scoring (15% of total) evaluates breakthrough capabilities and paradigm
            shifts in AI coding tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Key Innovation Dimensions</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">🤖 Autonomy Architecture</h4>
                    <Badge>25%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Planning sophistication, execution independence, and learning capabilities
                  </p>
                  <div className="text-xs text-muted-foreground pl-4">
                    • Basic (1-3): Single-step execution with manual guidance
                    <br />
                    • Advanced (4-6): Multi-step planning with checkpoints
                    <br />• Revolutionary (7-10): Self-improving autonomous systems
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">🧠 Context Understanding</h4>
                    <Badge>20%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Codebase comprehension, context scale, and multi-modal integration
                  </p>
                  <div className="text-xs text-muted-foreground pl-4">
                    • File-level (1-3): Single file understanding
                    <br />
                    • Project-level (4-6): Full architecture comprehension
                    <br />• Business-level (7-10): Intent and logic understanding
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">⚡ Technical Capabilities</h4>
                    <Badge>20%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    AI model innovation, unique features, and performance breakthroughs
                  </p>
                  <div className="text-xs text-muted-foreground pl-4">
                    • Standard (1-3): Off-the-shelf implementations
                    <br />
                    • Enhanced (4-6): Custom models and orchestration
                    <br />• Breakthrough (7-10): Novel architectures and paradigms
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">🔄 Workflow Transformation</h4>
                    <Badge>15%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Development process innovation and human-AI collaboration models
                  </p>
                  <div className="text-xs text-muted-foreground pl-4">
                    • Enhancement (1-3): Improves existing workflows
                    <br />
                    • Innovation (4-6): Enables new methodologies
                    <br />• Revolution (7-10): Fundamentally changes development
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">🌐 Ecosystem Integration</h4>
                    <Badge>10%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Protocol innovation and platform strategy
                  </p>
                  <div className="text-xs text-muted-foreground pl-4">
                    • Standard (1-3): Traditional integrations
                    <br />
                    • Protocol Creation (4-6): Open standards (MCP, A2A)
                    <br />• Industry Leadership (7-10): Wide protocol adoption
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">📊 Market Impact</h4>
                    <Badge>10%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Category innovation and industry influence
                  </p>
                  <div className="text-xs text-muted-foreground pl-4">
                    • Participant (1-3): Competes in existing categories
                    <br />
                    • Category Leader (4-6): Defines category standards
                    <br />• Category Creator (7-10): Creates new paradigms
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Scoring Scale</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">9-10</span>
                    <span className="text-muted-foreground">Revolutionary breakthrough</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">7-8</span>
                    <span className="text-muted-foreground">Major innovation</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">5-6</span>
                    <span className="text-muted-foreground">Significant advancement</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">3-4</span>
                    <span className="text-muted-foreground">Incremental improvement</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">1-2</span>
                    <span className="text-muted-foreground">Minimal innovation</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">0</span>
                    <span className="text-muted-foreground">No innovation</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Innovation scores are evaluated monthly and consider both
                absolute innovation and relative progress within the competitive landscape. Scores
                may decrease over time as innovations become standard features.
              </p>
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
