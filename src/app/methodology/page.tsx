import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default function MethodologyPage(): React.JSX.Element {
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Methodology</h1>
        <p className="text-muted-foreground text-lg">
          How we calculate the AI Power Ranking using Algorithm v7.0
        </p>
      </div>

      {/* Algorithm Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Algorithm v7.0: Dynamic News Intelligence & Tool Capabilities</CardTitle>
          <CardDescription>
            Our ranking system combines 8 key factors with sophisticated modifiers, dynamic
            news-based velocity scoring, and enhanced tool capability assessment to provide the most
            accurate and fair rankings of AI coding tools
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Key Features</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Dynamic velocity scoring from real-time news analysis</li>
              <li>Enhanced subprocess and tool capability assessment</li>
              <li>Innovation decay with 6-month half-life</li>
              <li>Platform risk penalties and bonuses</li>
              <li>Revenue quality adjustments by business model</li>
              <li>Enhanced technical performance weighting</li>
              <li>Data validation requirements (80% completeness)</li>
              <li>Logarithmic scaling for exponential metrics</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Factors */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Scoring Factors</CardTitle>
          <CardDescription>
            Eight weighted factors that determine each tool&apos;s overall score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Primary Factors */}
            <div>
              <h3 className="font-semibold mb-3">Primary Factors (80% total weight)</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Agentic Capability</h4>
                      <Badge>30%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Autonomous coding abilities, planning depth, multi-file handling, context
                      utilization, subprocess management, and tool capability support
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Innovation</h4>
                      <Badge>15%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Technical breakthroughs and paradigm shifts, subject to temporal decay
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Technical Performance</h4>
                      <Badge>12.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      SWE-bench scores with enhanced weighting, multi-file capability (30%), context
                      window (20%), language support (10%), and subprocess performance metrics
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Developer Adoption</h4>
                      <Badge>12.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      User base size, GitHub stars, and community engagement
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Market Traction</h4>
                      <Badge>12.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Revenue (quality-adjusted), valuation, and growth rate with logarithmic
                      scaling
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Secondary Factors */}
            <div>
              <h3 className="font-semibold mb-3">Secondary Factors (20% total weight)</h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Business Sentiment</h4>
                      <Badge variant="secondary">7.5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Market perception, partnerships, conflicts, subject to platform risk modifiers
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Development Velocity</h4>
                      <Badge variant="secondary">5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Dynamic momentum based on news sentiment analysis, feature releases, and
                      community response with 30-day rolling window
                    </p>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">Platform Resilience</h4>
                      <Badge variant="secondary">5%</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Multi-LLM support, self-hosting options, and independence (minimum threshold)
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
          <CardTitle>Algorithm Modifiers</CardTitle>
          <CardDescription>
            Three sophisticated modifiers that adjust scores based on real-world factors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">🔄 Innovation Decay</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Innovation scores decay exponentially with a 6-month half-life to reflect the
              fast-moving AI landscape
            </p>
            <div className="bg-muted p-4 rounded-md">
              <code className="text-xs">score = originalScore * e^(-0.115 * monthsOld)</code>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">⚠️ Platform Risk Modifiers</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Penalties and bonuses based on platform dependencies and strategic vulnerabilities
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Penalties</h4>
                <ul className="text-xs space-y-1">
                  <li>• Acquired by LLM provider: -2.0</li>
                  <li>• Exclusive LLM dependency: -1.0</li>
                  <li>• Competitor controlled: -1.5</li>
                  <li>• Regulatory risk: -0.5</li>
                  <li>• Funding distress: -1.0</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Bonuses</h4>
                <ul className="text-xs space-y-1">
                  <li>• Multi-LLM support: +0.5</li>
                  <li>• Open source LLM ready: +0.3</li>
                  <li>• Self-hosted option: +0.3</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">💰 Revenue Quality</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Business model affects how revenue contributes to market traction scoring
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enterprise High ACV (&gt;$100k)</span>
                <span className="font-mono">100%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Enterprise Standard ($10-100k)</span>
                <span className="font-mono">80%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>SMB SaaS (&lt;$10k)</span>
                <span className="font-mono">60%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Consumer Premium</span>
                <span className="font-mono">50%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Freemium</span>
                <span className="font-mono">30%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Open Source/Donations</span>
                <span className="font-mono">20%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic News Intelligence */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>🚀 Dynamic News Intelligence</CardTitle>
          <CardDescription>
            Real-time velocity and momentum scoring based on news analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">News-Based Velocity Scoring</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Development velocity is now dynamically calculated using a sophisticated news analysis
              system that tracks momentum across multiple dimensions.
            </p>
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-1">Momentum Indicators</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Product releases and feature announcements</li>
                  <li>• Partnership and integration news</li>
                  <li>• Technical breakthroughs and benchmarks</li>
                  <li>• Community adoption and success stories</li>
                  <li>• Industry recognition and awards</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">Sentiment Analysis</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Positive momentum: +3 to +5 boost</li>
                  <li>• Strong progress: +1 to +3 boost</li>
                  <li>• Neutral/stable: 0 adjustment</li>
                  <li>• Challenges/setbacks: -1 to -3 penalty</li>
                  <li>• Critical issues: -3 to -5 penalty</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">30-Day Rolling Window</h3>
            <p className="text-sm text-muted-foreground">
              Velocity scores use a 30-day rolling window with exponential decay, giving more weight
              to recent developments while maintaining trend awareness.
            </p>
            <div className="bg-muted p-4 rounded-md mt-2">
              <code className="text-xs">
                velocityScore = Σ(sentimentScore * e^(-λ * daysOld)) / 30
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subprocess & Tool Support */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>🔧 Subprocess & Tool Support Scoring</CardTitle>
          <CardDescription>
            Enhanced evaluation of agentic capabilities through subprocess and tool management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Tool Capability Assessment</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Agentic capability scoring now includes sophisticated evaluation of subprocess
              orchestration and tool utilization.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Subprocess Management (40%)</h4>
                <ul className="text-xs space-y-1">
                  <li>• Multi-agent orchestration</li>
                  <li>• Task delegation sophistication</li>
                  <li>• Parallel execution capabilities</li>
                  <li>• Context passing and integration</li>
                  <li>• Error handling and recovery</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Tool Ecosystem (60%)</h4>
                <ul className="text-xs space-y-1">
                  <li>• Native tool support depth</li>
                  <li>• Third-party tool integration</li>
                  <li>• Custom tool creation APIs</li>
                  <li>• Tool discovery and selection</li>
                  <li>• Protocol support (MCP, etc.)</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Scoring Rubric</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Advanced multi-tool orchestration</span>
                <span className="font-mono">+5.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sophisticated subprocess management</span>
                <span className="font-mono">+4.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Rich native tool ecosystem</span>
                <span className="font-mono">+3.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Basic tool support</span>
                <span className="font-mono">+1.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Limited/no tool capabilities</span>
                <span className="font-mono">0.0</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Technical Performance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>⚡ Enhanced Technical Performance</CardTitle>
          <CardDescription>
            Updated SWE-bench interpretation and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">SWE-bench Score Interpretation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Technical performance scoring now uses a more nuanced interpretation of SWE-bench
              results with logarithmic scaling.
            </p>
            <div className="bg-muted p-4 rounded-md">
              <code className="text-xs">
                technicalScore = log(1 + sweBenchScore) * performanceMultiplier
              </code>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Performance Multipliers</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Exceptional performance (&gt;90th percentile)</span>
                <span className="font-mono">1.5x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Strong performance (75-90th percentile)</span>
                <span className="font-mono">1.3x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Good performance (50-75th percentile)</span>
                <span className="font-mono">1.1x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Average performance (25-50th percentile)</span>
                <span className="font-mono">1.0x</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Below average (&lt;25th percentile)</span>
                <span className="font-mono">0.8x</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources & Validation</CardTitle>
          <CardDescription>How we collect and validate data for accurate rankings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Data Collection</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Public API data from GitHub, Product Hunt, and official sources</li>
              <li>Industry research reports and benchmarks</li>
              <li>Company announcements and press releases</li>
              <li>Community feedback and expert assessments</li>
              <li>Technical benchmarks (SWE-bench, HumanEval, etc.)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Validation Requirements</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Minimum 80% data completeness for ranking inclusion</li>
              <li>Source reliability scoring (60% confidence threshold)</li>
              <li>Outlier detection for suspicious changes (&gt;50% month-over-month)</li>
              <li>Cross-validation with multiple sources when available</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Update Frequency</h3>
            <p className="text-sm text-muted-foreground">
              Rankings are updated weekly with new data. Major algorithm updates are versioned and
              documented with full changelog.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
