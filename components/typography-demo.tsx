"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TypographyDemo() {
  return (
    <div className="space-y-12 p-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-4 py-12">
        <h1 className="hero-title animate-fade-in-down">AI Power Rankings</h1>
        <p className="hero-subtitle animate-fade-in-up max-w-3xl mx-auto">
          Discover the most powerful AI tools and frameworks shaping the future of technology. Our
          comprehensive rankings help you make informed decisions.
        </p>
        <div className="flex gap-4 justify-center animate-fade-in">
          <Button size="lg" className="hover-lift">
            Explore Rankings
          </Button>
          <Button variant="outline" size="lg" className="hover-lift">
            Learn More
          </Button>
        </div>
      </section>

      {/* Typography Scale */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="section-title">Typography Scale</h2>
          <p className="section-subtitle">
            A fluid, responsive typography system that scales beautifully across devices
          </p>
        </div>

        <Card className="hover-shadow">
          <CardHeader>
            <CardTitle>Heading Examples</CardTitle>
            <CardDescription>
              Our heading hierarchy uses a modular scale for perfect visual rhythm
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <h1>Heading 1 - Bold and Impactful</h1>
            <h2>Heading 2 - Section Headers</h2>
            <h3>Heading 3 - Subsection Headers</h3>
            <h4>Heading 4 - Group Headers</h4>
            <h5>Heading 5 - Item Headers</h5>
            <h6>HEADING 6 - SMALL CAPS STYLE</h6>
          </CardContent>
        </Card>
      </section>

      {/* Prose Content */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="section-title">Article Content</h2>
          <p className="section-subtitle">Rich text content with enhanced readability</p>
        </div>

        <Card>
          <CardContent className="prose prose-lg dark:prose-dark max-w-none pt-6">
            <h2>The Evolution of AI Tools</h2>
            <p className="lead">
              The landscape of artificial intelligence is evolving at an unprecedented pace,
              bringing revolutionary tools that transform how we work, create, and innovate.
            </p>
            <p>
              From <strong>code generation</strong> to <em>content creation</em>, modern AI tools
              are democratizing access to advanced capabilities. The latest models demonstrate
              remarkable improvements in reasoning, creativity, and problem-solving abilities.
            </p>
            <h3>Key Categories</h3>
            <ul>
              <li>
                <strong>Language Models:</strong> GPT-4, Claude, and Gemini lead the pack with
                advanced reasoning capabilities
              </li>
              <li>
                <strong>Code Assistants:</strong> GitHub Copilot and Cursor revolutionize software
                development
              </li>
              <li>
                <strong>Creative Tools:</strong> Midjourney and DALL-E push the boundaries of visual
                creativity
              </li>
            </ul>
            <blockquote>
              "The best AI tools don't replace human creativity—they amplify it, opening new
              possibilities we never imagined before."
            </blockquote>
            <p>
              As we look toward the future, the integration of AI into our daily workflows becomes
              increasingly seamless. Tools are becoming more intuitive, more powerful, and more
              accessible to users regardless of technical expertise.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Components Showcase */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="section-title">Component Showcase</h2>
          <p className="section-subtitle">Interactive components with refined animations</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Claude 3.5
                <Badge variant="success">Active</Badge>
              </CardTitle>
              <CardDescription>Advanced reasoning and analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                State-of-the-art language model with exceptional coding and analytical capabilities.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">98% Score</Badge>
                <Badge variant="info">Trending</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                GPT-4
                <Badge variant="warning">Limited</Badge>
              </CardTitle>
              <CardDescription>Versatile AI assistant</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                OpenAI's flagship model offering broad capabilities across various domains.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">95% Score</Badge>
                <Badge variant="secondary">Popular</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Cursor
                <Badge>New</Badge>
              </CardTitle>
              <CardDescription>AI-powered code editor</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Revolutionary IDE that integrates AI directly into the development workflow.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">92% Score</Badge>
                <Badge variant="success">Rising</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Links and Navigation */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="section-title">Links & Navigation</h2>
          <p className="section-subtitle">Enhanced link styles with smooth animations</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <nav className="space-y-6">
              <div className="flex gap-6 flex-wrap">
                <a href="#" className="font-medium hover:text-primary-hover">
                  Home
                </a>
                <a href="#" className="font-medium hover:text-primary-hover active">
                  Rankings
                </a>
                <a href="#" className="font-medium hover:text-primary-hover">
                  Tools
                </a>
                <a href="#" className="font-medium hover:text-primary-hover">
                  News
                </a>
                <a href="#" className="font-medium hover:text-primary-hover">
                  About
                </a>
              </div>

              <div className="prose">
                <p>
                  Explore our comprehensive <a href="#">AI tool rankings</a> to find the perfect
                  solution for your needs. Check out the latest <a href="#">industry updates</a> and{" "}
                  <a href="#">expert insights</a> on our blog.
                </p>
              </div>
            </nav>
          </CardContent>
        </Card>
      </section>

      {/* Button Variations */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="section-title">Interactive Elements</h2>
          <p className="section-subtitle">Buttons and actions with refined interactions</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex gap-4 flex-wrap">
              <Button>Primary Action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link Style</Button>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="destructive">Error</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Animations Showcase */}
      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="section-title">Animations</h2>
          <p className="section-subtitle">Subtle animations that enhance user experience</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle>Fade In</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Smooth entrance animation</p>
            </CardContent>
          </Card>

          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle>Fade In Up</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Rises into view</p>
            </CardContent>
          </Card>

          <Card className="animate-scale-in">
            <CardHeader>
              <CardTitle>Scale In</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Grows into place</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
