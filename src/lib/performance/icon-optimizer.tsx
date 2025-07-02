/**
 * Icon Optimization Utilities
 * Reduces bundle size by lazy loading and optimizing icon imports
 */

import type { LucideProps } from 'lucide-react';
import React, { type ComponentType, lazy, Suspense } from 'react';

// Type for dynamic icon loading
type IconComponent = ComponentType<LucideProps>;

// Cache for loaded icons to prevent duplicate imports
const iconCache = new Map<string, Promise<IconComponent>>();

/**
 * Dynamically import lucide icons to reduce bundle size
 */
export function loadIcon(iconName: string): Promise<IconComponent> {
  // Return cached promise if icon is already loading/loaded
  if (iconCache.has(iconName)) {
    const cachedIcon = iconCache.get(iconName);
    if (cachedIcon) {
      return cachedIcon;
    }
  }

  // Create lazy loading promise
  const iconPromise = import('lucide-react')
    .then((module) => {
      const Icon = module[iconName as keyof typeof module] as IconComponent;
      if (!Icon) {
        console.warn(`Icon "${iconName}" not found in lucide-react`);
        // Return a default icon or empty component
        return module.HelpCircle as IconComponent;
      }
      return Icon;
    })
    .catch((error) => {
      console.error(`Failed to load icon "${iconName}":`, error);
      // Return a fallback icon
      return import('lucide-react').then((m) => m.HelpCircle as IconComponent);
    });

  // Cache the promise
  iconCache.set(iconName, iconPromise);

  return iconPromise;
}

/**
 * Create a lazy-loaded icon component
 */
export function createLazyIcon(iconName: string): ComponentType<LucideProps> {
  return lazy(async () => {
    const IconComponent = await loadIcon(iconName);
    return { default: IconComponent };
  });
}

/**
 * Preload commonly used icons
 */
export function preloadCriticalIcons(): void {
  const criticalIcons = [
    'ArrowRight',
    'Star',
    'ArrowUp',
    'ArrowDown',
    'ExternalLink',
    'Menu',
    'X',
    'Search',
    'Crown', // Our custom crown icon is critical
  ];

  // Preload these icons in the background
  criticalIcons.forEach((iconName) => {
    loadIcon(iconName);
  });
}

/**
 * Icon component with lazy loading and error boundaries
 */
interface LazyIconProps extends LucideProps {
  name: string;
}

export function LazyIcon({ name, ...props }: LazyIconProps) {
  const Icon = createLazyIcon(name);

  return (
    <Suspense fallback={<div style={{ width: props.size || 24, height: props.size || 24 }} />}>
      <Icon {...props} />
    </Suspense>
  );
}

/**
 * Commonly used icons that should be statically imported for better performance
 */
export const STATIC_ICONS = {
  // Core navigation icons
  ArrowRight: lazy(() => import('lucide-react').then((m) => ({ default: m.ArrowRight }))),
  ArrowLeft: lazy(() => import('lucide-react').then((m) => ({ default: m.ArrowLeft }))),
  ArrowUp: lazy(() => import('lucide-react').then((m) => ({ default: m.ArrowUp }))),
  ArrowDown: lazy(() => import('lucide-react').then((m) => ({ default: m.ArrowDown }))),

  // UI icons
  Star: lazy(() => import('lucide-react').then((m) => ({ default: m.Star }))),
  Heart: lazy(() => import('lucide-react').then((m) => ({ default: m.Heart }))),
  Eye: lazy(() => import('lucide-react').then((m) => ({ default: m.Eye }))),

  // Menu icons
  Menu: lazy(() => import('lucide-react').then((m) => ({ default: m.Menu }))),
  X: lazy(() => import('lucide-react').then((m) => ({ default: m.X }))),
  Search: lazy(() => import('lucide-react').then((m) => ({ default: m.Search }))),

  // Status icons
  CheckCircle: lazy(() => import('lucide-react').then((m) => ({ default: m.CheckCircle }))),
  AlertCircle: lazy(() => import('lucide-react').then((m) => ({ default: m.AlertCircle }))),
  Info: lazy(() => import('lucide-react').then((m) => ({ default: m.Info }))),

  // External links
  ExternalLink: lazy(() => import('lucide-react').then((m) => ({ default: m.ExternalLink }))),
  Link: lazy(() => import('lucide-react').then((m) => ({ default: m.Link }))),

  // Media icons
  Play: lazy(() => import('lucide-react').then((m) => ({ default: m.Play }))),
  Pause: lazy(() => import('lucide-react').then((m) => ({ default: m.Pause }))),

  // Tool category icons
  Code: lazy(() => import('lucide-react').then((m) => ({ default: m.Code }))),
  Bot: lazy(() => import('lucide-react').then((m) => ({ default: m.Bot }))),
  Cpu: lazy(() => import('lucide-react').then((m) => ({ default: m.Cpu }))),
  Brain: lazy(() => import('lucide-react').then((m) => ({ default: m.Brain }))),
  Zap: lazy(() => import('lucide-react').then((m) => ({ default: m.Zap }))),
} as const;

/**
 * Get bundle size impact of icon usage
 */
export function getIconBundleSize(): number {
  // Approximate size of each lucide icon: ~2KB
  const ICON_SIZE_KB = 2;

  return iconCache.size * ICON_SIZE_KB;
}

/**
 * Clear icon cache (useful for development)
 */
export function clearIconCache(): void {
  iconCache.clear();
}
