'use client';

/**
 * Generation Statistics Component
 * Displays LLM generation metadata including token usage, cost, and performance
 */

import React from 'react';
import type { GenerationMetadata } from '@/lib/services/openrouter.service';

interface GenerationStatsProps {
  metadata: GenerationMetadata;
  title?: string;
  className?: string;
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(4)}c`; // Show in cents for very small amounts
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Format model name for display
 */
function formatModelName(model: string): string {
  return model.replace('anthropic/', '').replace('openai/', '');
}

/**
 * Generation Statistics Display Component
 */
export function GenerationStats({ metadata, title, className = '' }: GenerationStatsProps) {
  const successClass = metadata.success ? 'text-green-600' : 'text-red-600';
  const successBg = metadata.success ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{title}</h3>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Status */}
        <div className={`rounded-md ${successBg} p-3`}>
          <div className="text-xs text-gray-600">Status</div>
          <div className={`text-lg font-semibold ${successClass}`}>
            {metadata.success ? 'Success' : 'Failed'}
          </div>
          {metadata.attempts > 1 && (
            <div className="text-xs text-gray-500">{metadata.attempts} attempts</div>
          )}
        </div>

        {/* Model */}
        <div className="rounded-md bg-blue-50 p-3">
          <div className="text-xs text-gray-600">Model</div>
          <div className="text-sm font-semibold text-blue-900" title={metadata.model}>
            {formatModelName(metadata.model)}
          </div>
        </div>

        {/* Tokens */}
        <div className="rounded-md bg-purple-50 p-3">
          <div className="text-xs text-gray-600">Tokens</div>
          <div className="text-lg font-semibold text-purple-900">
            {metadata.totalTokens.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {metadata.promptTokens.toLocaleString()} in / {metadata.completionTokens.toLocaleString()} out
          </div>
        </div>

        {/* Cost */}
        <div className="rounded-md bg-orange-50 p-3">
          <div className="text-xs text-gray-600">Cost</div>
          <div className="text-lg font-semibold text-orange-900">
            {formatCost(metadata.estimatedCost)}
          </div>
          <div className="text-xs text-gray-500">Estimated</div>
        </div>

        {/* Duration */}
        <div className="rounded-md bg-cyan-50 p-3">
          <div className="text-xs text-gray-600">Duration</div>
          <div className="text-lg font-semibold text-cyan-900">
            {formatDuration(metadata.durationMs)}
          </div>
          {metadata.attempts > 1 && (
            <div className="text-xs text-gray-500">
              ~{formatDuration(metadata.durationMs / metadata.attempts)}/attempt
            </div>
          )}
        </div>
      </div>

      {/* Error message if failed */}
      {!metadata.success && metadata.error && (
        <div className="mt-3 rounded-md bg-red-50 p-3">
          <div className="text-xs font-semibold text-red-800">Error</div>
          <div className="mt-1 text-sm text-red-700">{metadata.error}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Aggregate statistics component for multiple generations
 */
interface AggregateStatsProps {
  generations: GenerationMetadata[];
  title?: string;
  className?: string;
}

export function AggregateGenerationStats({
  generations,
  title = 'Generation Statistics',
  className = ''
}: AggregateStatsProps) {
  if (generations.length === 0) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
        <p className="text-sm text-gray-500">No generation data available</p>
      </div>
    );
  }

  const totalCost = generations.reduce((sum, g) => sum + g.estimatedCost, 0);
  const totalTokens = generations.reduce((sum, g) => sum + g.totalTokens, 0);
  const totalDuration = generations.reduce((sum, g) => sum + g.durationMs, 0);
  const successCount = generations.filter(g => g.success).length;
  const successRate = (successCount / generations.length) * 100;
  const avgAttempts = generations.reduce((sum, g) => sum + g.attempts, 0) / generations.length;

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <h3 className="mb-4 text-base font-semibold text-gray-800">{title}</h3>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Generations */}
        <div className="rounded-md bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Total</div>
          <div className="text-xl font-bold text-gray-900">{generations.length}</div>
          <div className="text-xs text-gray-500">Generations</div>
        </div>

        {/* Success Rate */}
        <div className="rounded-md bg-green-50 p-3">
          <div className="text-xs text-gray-600">Success Rate</div>
          <div className="text-xl font-bold text-green-900">{successRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">{successCount}/{generations.length}</div>
        </div>

        {/* Total Cost */}
        <div className="rounded-md bg-orange-50 p-3">
          <div className="text-xs text-gray-600">Total Cost</div>
          <div className="text-xl font-bold text-orange-900">{formatCost(totalCost)}</div>
          <div className="text-xs text-gray-500">Estimated</div>
        </div>

        {/* Total Tokens */}
        <div className="rounded-md bg-purple-50 p-3">
          <div className="text-xs text-gray-600">Total Tokens</div>
          <div className="text-xl font-bold text-purple-900">
            {(totalTokens / 1000).toFixed(1)}K
          </div>
          <div className="text-xs text-gray-500">{totalTokens.toLocaleString()}</div>
        </div>

        {/* Avg Duration */}
        <div className="rounded-md bg-cyan-50 p-3">
          <div className="text-xs text-gray-600">Avg Duration</div>
          <div className="text-xl font-bold text-cyan-900">
            {formatDuration(totalDuration / generations.length)}
          </div>
          <div className="text-xs text-gray-500">Per generation</div>
        </div>

        {/* Avg Attempts */}
        <div className="rounded-md bg-blue-50 p-3">
          <div className="text-xs text-gray-600">Avg Attempts</div>
          <div className="text-xl font-bold text-blue-900">{avgAttempts.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Per generation</div>
        </div>
      </div>

      {/* Model breakdown */}
      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-700">Model Usage</div>
        <div className="mt-2 space-y-1">
          {Object.entries(
            generations.reduce((acc, g) => {
              acc[g.model] = (acc[g.model] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([model, count]) => (
            <div key={model} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{formatModelName(model)}</span>
              <span className="font-medium text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
