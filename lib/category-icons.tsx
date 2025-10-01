import {
  Code2,
  Bot,
  PenTool,
  Search,
  Zap,
  Palette,
  MessageSquare,
  BarChart3,
  GraduationCap,
  Globe,
  Terminal,
  FileCode2,
  CheckCircle,
  FileText,
  Shield,
  Cloud,
  Users,
  MessageCircle,
  Wrench,
  Package,
  Blocks,
  type LucideIcon,
} from "lucide-react";

// Category icon mapping with lucide-react icons
export const categoryIcons: Record<string, LucideIcon> = {
  // Primary categories from requirements
  "ide-assistant": Code2,
  "coding-agents": Bot,
  "writing-assistant": PenTool,
  research: Search,
  productivity: Zap,
  creative: Palette,
  communication: MessageSquare,
  "data-analysis": BarChart3,
  education: GraduationCap,
  "browser-copilot": Globe,

  // Additional categories found in the codebase
  "autonomous-agent": Bot,
  "code-completion": FileCode2,
  testing: CheckCircle,
  "testing-tool": CheckCircle,
  documentation: FileText,
  "code-review": Search,
  security: Shield,
  "cloud-ide": Cloud,
  collaboration: Users,
  "ai-chat": MessageCircle,
  "devops-assistant": Wrench,
  product: Package,
  "code-editor": Terminal,
  "app-builder": Blocks,
  "open-source-framework": Package,

  // Default fallback
  default: Zap,
};

/**
 * Get the icon component for a given category
 * @param category The category slug
 * @returns The corresponding Lucide icon component
 */
export function getCategoryIcon(category: string): LucideIcon {
  return categoryIcons[category] || categoryIcons.default;
}

/**
 * Render a category icon with consistent styling
 * @param category The category slug
 * @param className Additional CSS classes
 * @param size Icon size in pixels (default: 16)
 */
export function CategoryIcon({
  category,
  className = "",
  size = 16,
}: {
  category: string;
  className?: string;
  size?: number;
}) {
  const Icon = getCategoryIcon(category);
  return <Icon className={className} size={size} />;
}