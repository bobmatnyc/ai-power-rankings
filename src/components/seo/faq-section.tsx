"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

interface FAQSectionProps {
  title?: string;
  faqs: FAQItem[];
  defaultOpen?: string[]; // IDs of FAQs to open by default
  className?: string;
}

export function FAQSection({
  title = "Frequently Asked Questions",
  faqs,
  defaultOpen = [],
  className = "",
}: FAQSectionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen));

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <Card className={className} itemScope itemType="https://schema.org/FAQPage">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.id}
            itemScope
            itemType="https://schema.org/Question"
            className="border rounded-lg"
          >
            <Collapsible open={openItems.has(faq.id)} onOpenChange={() => toggleItem(faq.id)}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors">
                  <h3 className="font-medium text-sm md:text-base" itemProp="name">
                    {faq.question}
                  </h3>
                  <div className="flex-shrink-0 ml-4">
                    {openItems.has(faq.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div
                  className="px-4 pb-4 text-muted-foreground"
                  itemProp="acceptedAnswer"
                  itemScope
                  itemType="https://schema.org/Answer"
                >
                  <div itemProp="text" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
