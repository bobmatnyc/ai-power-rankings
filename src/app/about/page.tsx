import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AboutPage(): React.JSX.Element {
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">About AI Power Rankings</h1>
        <p className="text-muted-foreground text-lg">
          The definitive ranking system for AI coding tools
        </p>
      </div>

      {/* Mission */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Our Mission</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            AI Power Rankings provides data-driven, objective rankings of AI coding tools to help
            developers, teams, and organizations make informed decisions. In the rapidly evolving
            landscape of AI-assisted development, we cut through the marketing noise to deliver
            clear, actionable insights based on real performance metrics and comprehensive analysis.
          </p>
        </CardContent>
      </Card>

      {/* What We Do */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What We Do</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">🔍 Comprehensive Analysis</h3>
            <p className="text-sm text-muted-foreground">
              We analyze over 30 AI coding tools across 8 key performance factors, from autonomous
              capabilities to market traction, using publicly available data and industry
              benchmarks.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">📊 Transparent Methodology</h3>
            <p className="text-sm text-muted-foreground">
              Our Algorithm v6.0 uses sophisticated modifiers including innovation decay, platform
              risk assessment, and revenue quality adjustments to ensure fair and accurate rankings.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🔄 Regular Updates</h3>
            <p className="text-sm text-muted-foreground">
              Rankings are updated weekly with new data, and our algorithm evolves based on industry
              feedback and emerging trends in AI development.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🌍 Community-Driven</h3>
            <p className="text-sm text-muted-foreground">
              We welcome contributions, corrections, and suggestions from the developer community to
              ensure our rankings reflect real-world experiences and needs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Why It Matters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Why Rankings Matter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            The AI coding tool landscape is evolving at breakneck speed. New tools launch weekly,
            existing tools pivot or get acquired, and capabilities advance rapidly. This creates
            several challenges:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
            <li>
              <strong>Decision Paralysis:</strong> With dozens of options, how do you choose the
              right tool for your needs?
            </li>
            <li>
              <strong>Marketing vs Reality:</strong> Bold claims about capabilities often don&apos;t
              match real-world performance.
            </li>
            <li>
              <strong>Rapid Change:</strong> Yesterday&apos;s leader might be today&apos;s laggard
              as the technology evolves.
            </li>
            <li>
              <strong>Hidden Risks:</strong> Platform dependencies, funding issues, and strategic
              conflicts can impact tool viability.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Our rankings provide a consistent, objective framework for evaluation, helping you
            navigate this complex landscape with confidence.
          </p>
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>The Team</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            AI Power Rankings is an independent project created and maintained by developers
            passionate about the future of AI-assisted coding. We have no affiliations with any of
            the tools we rank, ensuring complete objectivity.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/contact">Report an Issue</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Get Involved */}
      <Card>
        <CardHeader>
          <CardTitle>Get Involved</CardTitle>
          <CardDescription>Help us improve AI Power Rankings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">📢 Share Your Experience</h3>
            <p className="text-sm text-muted-foreground">
              Used any of these tools? Share your real-world experience to help others make better
              decisions.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🔧 Submit Data</h3>
            <p className="text-sm text-muted-foreground">
              Have access to metrics or benchmarks we&apos;re missing? Help us maintain the most
              comprehensive dataset.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">💡 Suggest Improvements</h3>
            <p className="text-sm text-muted-foreground">
              Ideas for new ranking factors or algorithm improvements? We&apos;re always looking to
              evolve our methodology.
            </p>
          </div>

          <div className="pt-4">
            <Button asChild className="w-full">
              <Link href="/contact">Get in Touch</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
