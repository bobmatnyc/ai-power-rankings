"use client";

import { AlertCircle, CheckCircle, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea"; // TODO: Add textarea component
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FormData {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
}

const contactCategories = [
  {
    value: "general",
    label: "General Inquiry",
    description: "General questions about AI Power Rankings",
  },
  {
    value: "press",
    label: "Press & Media",
    description: "Press inquiries, interviews, and media kit requests",
  },
  {
    value: "partnership",
    label: "Partnership & Business",
    description: "Partnership opportunities, advertising, and sponsorships",
  },
  {
    value: "technical",
    label: "Technical Support",
    description: "Website issues and technical support",
  },
  {
    value: "methodology",
    label: "Ranking Methodology",
    description: "Questions about our ranking methodology",
  },
  {
    value: "tool-submission",
    label: "Tool Submission",
    description: "Submit a new AI coding tool for inclusion",
  },
  {
    value: "issue-report",
    label: "Report an Issue",
    description: "Report errors or inaccuracies in rankings or content",
  },
  {
    value: "legal",
    label: "Legal Matters",
    description: "Legal inquiries, DMCA requests, and privacy concerns",
  },
];

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error" | "rate-limited">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    retryAfter?: number;
    limit?: number;
    reset?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.category || !formData.message) {
      setSubmitStatus("error");
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      // Send form data to API
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          setSubmitStatus("rate-limited");
          setRateLimitInfo({
            retryAfter: data.retryAfter,
            limit: data.limit,
            reset: data.reset,
          });
          setErrorMessage(
            data.message ||
              `Too many requests. Please try again in ${Math.ceil((data.retryAfter || 3600) / 60)} minutes.`
          );
          return;
        }
        throw new Error(data.error || "Failed to send message");
      }

      // Show success message
      setSubmitStatus("success");

      // Reset form after a delay
      setTimeout(() => {
        setFormData({
          name: "",
          email: "",
          subject: "",
          category: "",
          message: "",
        });
        setSubmitStatus("idle");
      }, 5000);
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send message. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (submitStatus === "error" || submitStatus === "rate-limited") {
      setSubmitStatus("idle");
      setErrorMessage("");
      setRateLimitInfo({});
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Contact Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send us a Message
          </CardTitle>
          <CardDescription>
            Fill out the form below and we&apos;ll get back to you within 48 hours during business
            days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name and Email */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange("category", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select inquiry type" />
                </SelectTrigger>
                <SelectContent>
                  {contactCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex flex-col">
                        <span>{category.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {category.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                type="text"
                placeholder="Brief description of your inquiry (optional)"
                value={formData.subject}
                onChange={(e) => handleInputChange("subject", e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <textarea
                id="message"
                placeholder="Please provide details about your inquiry..."
                value={formData.message}
                onChange={(e) => handleInputChange("message", e.target.value)}
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>

            {/* Tool Submission Helper */}
            {formData.category === "tool-submission" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>For tool submissions, please include:</strong>
                  <ul className="mt-2 ml-4 list-disc text-sm">
                    <li>Tool name and website URL</li>
                    <li>Brief description (100-200 words)</li>
                    <li>Key features and capabilities</li>
                    <li>Pricing information</li>
                    <li>Target audience</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Status Messages */}
            {submitStatus === "success" && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Your message has been sent successfully! We&apos;ll get back to you within 48
                  hours during business days.
                </AlertDescription>
              </Alert>
            )}

            {submitStatus === "error" && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
              </Alert>
            )}

            {submitStatus === "rate-limited" && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <div className="space-y-2">
                    <p className="font-medium">Rate limit exceeded</p>
                    <p>{errorMessage}</p>
                    {rateLimitInfo.retryAfter && (
                      <p className="text-sm">
                        You can submit another message in{" "}
                        <span className="font-medium">
                          {Math.ceil(rateLimitInfo.retryAfter / 60)} minutes
                        </span>
                        .
                      </p>
                    )}
                    <p className="text-xs text-orange-600">
                      This helps us prevent spam and ensure all messages receive proper attention.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || submitStatus === "rate-limited"}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              * Required fields. By submitting this form, you agree to our privacy policy.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="space-y-6">
        {/* Response Time */}
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We strive to respond to all inquiries within <strong>48 hours</strong> during business
              days. For urgent matters, please indicate so in your subject line.
            </p>
          </CardContent>
        </Card>

        {/* Social Media */}
        <Card>
          <CardHeader>
            <CardTitle>Follow Us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <a
                href="https://twitter.com/aipowerrankings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-primary transition-colors"
              >
                <strong>Twitter/X:</strong> @aipowerrankings
              </a>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <a
                href="https://linkedin.com/company/aipowerrankings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-primary transition-colors"
              >
                <strong>LinkedIn:</strong> AI Power Rankings
              </a>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
              <a
                href="https://github.com/aipowerrankings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-primary transition-colors"
              >
                <strong>GitHub:</strong> @aipowerrankings
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Additional Support */}
        <Card>
          <CardHeader>
            <CardTitle>Need Immediate Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              For urgent matters or technical issues, you can:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Check our FAQ section for common questions
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Follow us on social media for real-time updates
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Visit our GitHub for technical documentation
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
