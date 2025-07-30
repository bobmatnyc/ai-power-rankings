import { ArrowRight, Code2, Github, Heart, Star, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveCrownIcon } from "@/components/ui/optimized-image";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getCurrentYear } from "@/lib/get-current-year";
import { getUrl } from "@/lib/get-url";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/best-open-source-frameworks`;
  });

  return {
    title: `Best Open Source AI Frameworks ${currentYear} - Developer Tools & Libraries`,
    description: `Discover the best open source AI frameworks of ${currentYear}. Compare top machine learning libraries, AI development tools, and open source platforms. Updated weekly.`,
    keywords: [
      "best open source AI frameworks",
      "machine learning libraries",
      "AI development frameworks",
      `open source AI tools ${currentYear}`,
      "neural network frameworks",
      "deep learning libraries",
      "AI model frameworks",
      "machine learning platforms",
      "open source ML tools",
      "AI development platforms",
    ],
    openGraph: {
      title: `Best Open Source AI Frameworks ${currentYear} - Developer Tools & Libraries`,
      description: `Discover the best open source AI frameworks of ${currentYear}. Compare top machine learning libraries and development tools.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-open-source-frameworks`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/best-open-source-frameworks`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function BestOpenSourceFrameworksPage({ params }: PageProps) {
  const { lang } = await params;
  const currentYear = getCurrentYear();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <div className="flex justify-center mb-6">
          <ResponsiveCrownIcon priority={true} className="w-16 h-16" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Best Open Source AI Frameworks of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover the top open source AI frameworks and libraries that power machine learning
          development, neural networks, and AI applications across the industry.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=open-source-framework`}>
              View Framework Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=open-source-framework`}>
              Browse All Frameworks
            </Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>20+ Frameworks Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-blue-500" />
            <span>Open Source & Free</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span>Millions of Developers</span>
          </div>
        </div>
      </section>

      {/* What Makes a Great Open Source Framework */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes an Open Source AI Framework the Best?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Code2 className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Developer Experience</h3>
              <p className="text-muted-foreground">
                Intuitive APIs, comprehensive documentation, and active community support that
                accelerates development and learning.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Zap className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Performance & Scalability</h3>
              <p className="text-muted-foreground">
                Optimized computation engines, GPU acceleration, and distributed training
                capabilities for production-ready AI systems.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Heart className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Community & Ecosystem</h3>
              <p className="text-muted-foreground">
                Vibrant open source community, rich ecosystem of extensions, and strong industry
                adoption for long-term sustainability.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top Features to Look For */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Key Features of Top AI Frameworks</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Core Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Neural Network Support:</strong> Comprehensive deep learning
                    architectures and model types
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>GPU Acceleration:</strong> Native support for CUDA, ROCm, and other
                    high-performance computing
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Model Deployment:</strong> Production-ready inference and serving
                    capabilities
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Cross-Platform:</strong> Support for multiple operating systems and
                    hardware architectures
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Advanced Features</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Distributed Training:</strong> Multi-GPU and multi-node scaling for
                    large models
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>AutoML Capabilities:</strong> Automated model selection and
                    hyperparameter tuning
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Model Optimization:</strong> Quantization, pruning, and other
                    performance optimizations
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Integration Ecosystem:</strong> Rich plugins and integrations with
                    popular tools
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular Open Source Frameworks Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Popular Open Source Frameworks to Consider
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>PyTorch</span>
                <Badge variant="secondary">Research-First</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Dynamic neural network framework with Pythonic design, excellent debugging
                capabilities, and strong research community adoption.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Meta AI, Dynamic Graphs</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>TensorFlow</span>
                <Badge variant="secondary">Production-Ready</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Comprehensive ML platform with strong production deployment tools, mobile support,
                and extensive ecosystem of tools and libraries.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Google, TensorFlow Serving</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Hugging Face</span>
                <Badge variant="secondary">Transformers</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Leading platform for natural language processing with pre-trained models, datasets,
                and easy-to-use transformers library.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>NLP Focus, Pre-trained Models</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Build with Open Source AI?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the perfect open source AI framework that will
          accelerate your machine learning development and innovation.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=open-source-framework`}>
              View Complete Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/methodology`}>Learn Our Methodology</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
