/**
 * Performance monitoring utility for tracking long tasks and optimizing performance.
 * 
 * WHY: The app has multiple long tasks (50ms+) blocking the main thread,
 * causing poor interaction responsiveness and high Total Blocking Time (TBT).
 * This utility helps identify and track performance bottlenecks.
 * 
 * DESIGN DECISION: Use Performance Observer API to track long tasks,
 * User Timing API for custom metrics, and requestIdleCallback for
 * non-blocking performance reporting.
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface LongTask {
  name: string;
  duration: number;
  startTime: number;
  attribution: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private longTasks: LongTask[] = [];
  private observer: PerformanceObserver | null = null;
  private reportingEnabled = process.env.NODE_ENV === 'development';
  private maxMetricsSize = 100;
  private longTaskThreshold = 50; // milliseconds

  constructor() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initializeObserver();
    }
  }

  /**
   * Initialize Performance Observer to track long tasks.
   * 
   * WHY: Long tasks block the main thread and degrade user experience.
   * By tracking them, we can identify and optimize problematic code.
   */
  private initializeObserver(): void {
    try {
      // Check if long task monitoring is supported
      if (!PerformanceObserver.supportedEntryTypes.includes('longtask')) {
        console.warn('Long task monitoring not supported in this browser');
        return;
      }

      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.longTaskThreshold) {
            const longTask: LongTask = {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime,
              attribution: this.getTaskAttribution(entry)
            };
            
            this.longTasks.push(longTask);
            
            // Keep only recent long tasks
            if (this.longTasks.length > this.maxMetricsSize) {
              this.longTasks.shift();
            }
            
            // Log in development
            if (this.reportingEnabled) {
              console.warn(`Long task detected: ${longTask.duration.toFixed(2)}ms`, {
                name: longTask.name,
                attribution: longTask.attribution,
                startTime: longTask.startTime
              });
            }
            
            // Report critical long tasks
            if (longTask.duration > 200) {
              this.reportCriticalTask(longTask);
            }
          }
        }
      });

      this.observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      console.error('Failed to initialize performance observer:', error);
    }
  }

  /**
   * Get attribution information for a long task.
   */
  private getTaskAttribution(entry: any): string[] {
    const attribution: string[] = [];
    
    if (entry.attribution) {
      for (const attr of entry.attribution) {
        if (attr.containerType && attr.containerSrc) {
          attribution.push(`${attr.containerType}: ${attr.containerSrc}`);
        } else if (attr.containerType) {
          attribution.push(attr.containerType);
        }
      }
    }
    
    return attribution;
  }

  /**
   * Mark the start of a performance measurement.
   * 
   * @param markName Unique name for the mark
   * @param metadata Optional metadata to attach
   */
  mark(markName: string, metadata?: Record<string, any>): void {
    if (typeof window === 'undefined' || !window.performance) return;
    
    try {
      performance.mark(markName);
      
      if (metadata) {
        // Store metadata for later use
        (window as any).__perf_metadata = (window as any).__perf_metadata || {};
        (window as any).__perf_metadata[markName] = metadata;
      }
    } catch (error) {
      console.error(`Failed to create performance mark '${markName}':`, error);
    }
  }

  /**
   * Measure the duration between two marks or from navigation start.
   * 
   * @param measureName Name for the measurement
   * @param startMark Start mark name (or navigation start if not provided)
   * @param endMark End mark name (or current time if not provided)
   */
  measure(
    measureName: string, 
    startMark?: string, 
    endMark?: string
  ): number | null {
    if (typeof window === 'undefined' || !window.performance) return null;
    
    try {
      performance.measure(
        measureName,
        startMark,
        endMark
      );
      
      const entries = performance.getEntriesByName(measureName, 'measure');
      const entry = entries[entries.length - 1];
      
      if (entry) {
        const metric: PerformanceMetric = {
          name: measureName,
          value: entry.duration,
          timestamp: performance.now(),
          metadata: this.getMetadata(startMark)
        };
        
        this.metrics.push(metric);
        
        // Clean up old metrics
        if (this.metrics.length > this.maxMetricsSize) {
          this.metrics.shift();
        }
        
        // Log in development
        if (this.reportingEnabled) {
          console.log(`Performance: ${measureName} took ${entry.duration.toFixed(2)}ms`);
        }
        
        return entry.duration;
      }
    } catch (error) {
      console.error(`Failed to measure '${measureName}':`, error);
    }
    
    return null;
  }

  /**
   * Get stored metadata for a mark.
   */
  private getMetadata(markName?: string): Record<string, any> | undefined {
    if (!markName || typeof window === 'undefined') return undefined;
    
    const metadata = (window as any).__perf_metadata;
    return metadata?.[markName];
  }

  /**
   * Track a custom metric.
   * 
   * @param name Metric name
   * @param value Metric value
   * @param metadata Optional metadata
   */
  trackMetric(name: string, value: number, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: performance.now(),
      metadata
    };
    
    this.metrics.push(metric);
    
    // Clean up old metrics
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics.shift();
    }
    
    if (this.reportingEnabled) {
      console.log(`Metric: ${name} = ${value}`, metadata);
    }
  }

  /**
   * Report a critical long task.
   */
  private reportCriticalTask(task: LongTask): void {
    // In production, this could send to an analytics service
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        console.error('Critical long task detected:', {
          duration: `${task.duration.toFixed(2)}ms`,
          attribution: task.attribution,
          timestamp: new Date(performance.timeOrigin + task.startTime).toISOString()
        });
        
        // Track as custom metric
        this.trackMetric('critical_long_task', task.duration, {
          attribution: task.attribution
        });
      });
    }
  }

  /**
   * Get all recorded long tasks.
   */
  getLongTasks(): LongTask[] {
    return [...this.longTasks];
  }

  /**
   * Get all recorded metrics.
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get a summary of performance metrics.
   */
  getSummary(): {
    longTaskCount: number;
    totalBlockingTime: number;
    averageTaskDuration: number;
    criticalTaskCount: number;
    metrics: Record<string, { avg: number; min: number; max: number; count: number }>;
  } {
    const totalBlockingTime = this.longTasks.reduce(
      (sum, task) => sum + Math.max(0, task.duration - 50), 
      0
    );
    
    const criticalTaskCount = this.longTasks.filter(
      task => task.duration > 200
    ).length;
    
    // Aggregate metrics by name
    const metricsSummary: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const metric of this.metrics) {
      if (!metricsSummary[metric.name]) {
        metricsSummary[metric.name] = {
          avg: 0,
          min: Infinity,
          max: -Infinity,
          count: 0
        };
      }
      
      const summary = metricsSummary[metric.name];
      if (summary) {
        summary.count++;
        summary.avg = (summary.avg * (summary.count - 1) + metric.value) / summary.count;
        summary.min = Math.min(summary.min, metric.value);
        summary.max = Math.max(summary.max, metric.value);
      }
    }
    
    return {
      longTaskCount: this.longTasks.length,
      totalBlockingTime,
      averageTaskDuration: this.longTasks.length > 0 
        ? this.longTasks.reduce((sum, task) => sum + task.duration, 0) / this.longTasks.length
        : 0,
      criticalTaskCount,
      metrics: metricsSummary
    };
  }

  /**
   * Clear all recorded data.
   */
  clear(): void {
    this.metrics = [];
    this.longTasks = [];
  }

  /**
   * Cleanup and disconnect observer.
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clear();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for common measurements
export const perfUtils = {
  /**
   * Measure the execution time of an async function.
   */
  async measureAsync<T>(
    name: string, 
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    performanceMonitor.mark(`${name}-start`, metadata);
    
    try {
      const result = await fn();
      performanceMonitor.measure(name, `${name}-start`);
      return result;
    } catch (error) {
      performanceMonitor.measure(`${name}-error`, `${name}-start`);
      throw error;
    }
  },

  /**
   * Measure the execution time of a sync function.
   */
  measureSync<T>(
    name: string, 
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    performanceMonitor.mark(`${name}-start`, metadata);
    
    try {
      const result = fn();
      performanceMonitor.measure(name, `${name}-start`);
      return result;
    } catch (error) {
      performanceMonitor.measure(`${name}-error`, `${name}-start`);
      throw error;
    }
  },

  /**
   * Create a debounced version of a function that tracks performance.
   */
  debounceWithTracking<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    name: string
  ): T {
    let timeoutId: NodeJS.Timeout | null = null;
    let callCount = 0;
    
    return ((...args: Parameters<T>) => {
      callCount++;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        performanceMonitor.trackMetric(`${name}_debounce_calls`, callCount);
        callCount = 0;
        
        perfUtils.measureSync(`${name}_execution`, () => fn(...args));
      }, delay);
    }) as T;
  }
};