/**
 * Generation Metrics Display Component
 * Shows LLM generation cost, performance, and retry statistics
 */

import React from 'react';
import type { GenerationMetadata } from '@/lib/services/whats-new-summary.service';

interface GenerationMetricsProps {
  metadata: GenerationMetadata;
  className?: string;
  showDetailedMetrics?: boolean;
}

/**
 * Display generation metrics with cost tracking
 *
 * Design Decision: Cost transparency for admin users
 *
 * Rationale: LLM API costs can accumulate quickly. Displaying real-time
 * cost data helps admins make informed decisions about regeneration frequency
 * and understand the financial impact of retries.
 *
 * Trade-offs:
 * - Transparency: Users see exact costs vs. hidden operational expenses
 * - Complexity: More UI surface area vs. simpler "generate" button
 * - Education: Helps users understand LLM economics
 */
export function GenerationMetrics({
  metadata,
  className = '',
  showDetailedMetrics = true,
}: GenerationMetricsProps) {
  const {
    tokensUsed,
    estimatedCost,
    attempts,
    modelUsed,
    durationMs,
    llmDurationMs,
    retryDelaysMs = [],
  } = metadata;

  // Calculate retry overhead
  const totalRetryDelayMs = retryDelaysMs.reduce((sum, delay) => sum + delay, 0);
  const successRate = attempts > 0 ? ((1 / attempts) * 100).toFixed(0) : '100';

  return (
    <div className={`bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-blue-600">📊</span>
        Generation Metrics
      </h3>

      {/* Primary Metrics Grid */}
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Token Usage */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <dt className="text-sm text-gray-600 mb-1">Tokens Used</dt>
          <dd className="text-2xl font-bold text-gray-900 font-mono">
            {tokensUsed.toLocaleString()}
          </dd>
          <dd className="text-xs text-gray-500 mt-1">
            {(tokensUsed / 1000).toFixed(1)}K tokens
          </dd>
        </div>

        {/* Estimated Cost */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <dt className="text-sm text-gray-600 mb-1">Estimated Cost</dt>
          <dd className="text-2xl font-bold text-green-600 font-mono">
            ${estimatedCost.toFixed(4)}
          </dd>
          <dd className="text-xs text-gray-500 mt-1">
            ${(estimatedCost * 1000).toFixed(2)}/1K generations
          </dd>
        </div>

        {/* Attempts */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <dt className="text-sm text-gray-600 mb-1">Attempts</dt>
          <dd className="text-2xl font-bold text-blue-600 font-mono">
            {attempts}
          </dd>
          <dd className="text-xs text-gray-500 mt-1">
            {successRate}% success rate
          </dd>
        </div>

        {/* Duration */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <dt className="text-sm text-gray-600 mb-1">Total Duration</dt>
          <dd className="text-2xl font-bold text-purple-600 font-mono">
            {(durationMs / 1000).toFixed(1)}s
          </dd>
          <dd className="text-xs text-gray-500 mt-1">
            LLM: {(llmDurationMs / 1000).toFixed(1)}s
          </dd>
        </div>
      </dl>

      {/* Detailed Metrics */}
      {showDetailedMetrics && (
        <div className="space-y-4">
          {/* Model Information */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Model Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Model:</span>
                <span className="ml-2 font-mono text-gray-900">{modelUsed}</span>
              </div>
              <div>
                <span className="text-gray-600">Provider:</span>
                <span className="ml-2 font-mono text-gray-900">OpenRouter</span>
              </div>
            </div>
          </div>

          {/* Performance Breakdown */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Performance Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">LLM Generation Time:</span>
                <span className="font-mono text-gray-900">{(llmDurationMs / 1000).toFixed(2)}s</span>
              </div>
              {totalRetryDelayMs > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Retry Overhead:</span>
                  <span className="font-mono text-orange-600">+{(totalRetryDelayMs / 1000).toFixed(2)}s</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Database & Processing:</span>
                <span className="font-mono text-gray-900">
                  {((durationMs - llmDurationMs - totalRetryDelayMs) / 1000).toFixed(2)}s
                </span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-gray-200">
                <span className="text-gray-900">Total Time:</span>
                <span className="font-mono text-purple-600">{(durationMs / 1000).toFixed(2)}s</span>
              </div>
            </div>
          </div>

          {/* Retry Details (if retries occurred) */}
          {attempts > 1 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-orange-900 mb-2 flex items-center gap-2">
                <span>⚠️</span>
                Retry Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-orange-800">Failed Attempts:</span>
                  <span className="font-mono text-orange-900">{attempts - 1}</span>
                </div>
                {retryDelaysMs.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-orange-800">Retry Delays:</span>
                    <span className="font-mono text-orange-900">
                      {retryDelaysMs.map(d => `${(d / 1000).toFixed(1)}s`).join(', ')}
                    </span>
                  </div>
                )}
                <div className="text-xs text-orange-700 mt-2 italic">
                  Note: Failed attempts still consume API tokens and incur costs.
                </div>
              </div>
            </div>
          )}

          {/* Cost Projection */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Cost Projection</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-800">10 generations/month:</span>
                <span className="font-mono text-blue-900">${(estimatedCost * 10).toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-800">100 generations/month:</span>
                <span className="font-mono text-blue-900">${(estimatedCost * 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-blue-300">
                <span className="text-blue-900">1000 generations/month:</span>
                <span className="font-mono text-blue-900">${(estimatedCost * 1000).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact metrics display for inline use
 */
export function GenerationMetricsCompact({ metadata }: { metadata: GenerationMetadata }) {
  const { tokensUsed, estimatedCost, attempts, durationMs } = metadata;

  return (
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <div className="flex items-center gap-1">
        <span className="font-semibold">{tokensUsed.toLocaleString()}</span>
        <span>tokens</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-green-600">${estimatedCost.toFixed(4)}</span>
        <span>cost</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">{(durationMs / 1000).toFixed(1)}s</span>
        <span>duration</span>
      </div>
      {attempts > 1 && (
        <div className="flex items-center gap-1 text-orange-600">
          <span>⚠️</span>
          <span className="font-semibold">{attempts}</span>
          <span>attempts</span>
        </div>
      )}
    </div>
  );
}

/**
 * Badge component for cost warning thresholds
 */
export function CostWarningBadge({ cost, threshold = 0.10 }: { cost: number; threshold?: number }) {
  if (cost < threshold) {
    return null;
  }

  const warningLevel = cost > threshold * 2 ? 'high' : 'medium';

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
        warningLevel === 'high'
          ? 'bg-red-100 text-red-800 border border-red-300'
          : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
      }`}
    >
      <span>{warningLevel === 'high' ? '🔴' : '⚠️'}</span>
      <span>High cost generation</span>
    </div>
  );
}
