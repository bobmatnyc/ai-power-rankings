/**
 * Utilities for working with web workers for data processing.
 *
 * WHY: Web Workers allow us to move heavy computations off the main thread,
 * preventing UI freezes and improving responsiveness. This is critical for
 * processing large ranking datasets and complex calculations.
 *
 * DESIGN DECISION: Use a promise-based API with automatic worker pooling
 * to simplify usage and maximize performance across different devices.
 */

interface WorkerTask<T = any> {
  id: string;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timeout?: NodeJS.Timeout;
}

class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{ message: any; task: WorkerTask }> = [];
  private tasks = new Map<string, WorkerTask>();
  private maxWorkers: number;

  constructor(_workerScript: string, maxWorkers = navigator.hardwareConcurrency || 4) {
    // Worker script path is hardcoded in createWorker for proper URL resolution
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    // Create initial worker
    this.createWorker();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("../../workers/data-processor.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.addEventListener("message", (event) => {
      const { type, payload, success, error } = event.data;

      // Extract task ID from type (e.g., "PARSE_JSON_RESULT" -> original task ID)
      const taskType = type.replace("_RESULT", "").replace("_ERROR", "");
      const taskId = payload?.id || taskType;

      const task = this.tasks.get(taskId);
      if (task) {
        if (task.timeout) {
          clearTimeout(task.timeout);
        }

        this.tasks.delete(taskId);

        if (success) {
          task.resolve(payload);
        } else {
          task.reject(new Error(error || "Worker error"));
        }
      }

      // Return worker to pool
      this.availableWorkers.push(worker);
      this.processQueue();
    });

    worker.addEventListener("error", (error) => {
      console.error("Worker error:", error);

      // Remove failed worker
      const index = this.workers.indexOf(worker);
      if (index > -1) {
        this.workers.splice(index, 1);
      }

      // Create replacement worker if needed
      if (this.workers.length < this.maxWorkers && this.taskQueue.length > 0) {
        this.createWorker();
      }
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);

    return worker;
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const { message } = this.taskQueue.shift()!;
      const worker = this.availableWorkers.shift()!;

      worker.postMessage(message);

      // Create more workers if needed and queue is building up
      if (
        this.workers.length < this.maxWorkers &&
        this.taskQueue.length > this.availableWorkers.length
      ) {
        this.createWorker();
      }
    }
  }

  async execute<T>(message: any, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${message.type}_${Date.now()}_${Math.random()}`;

      const task: WorkerTask<T> = {
        id,
        resolve,
        reject,
      };

      // Set timeout
      task.timeout = setTimeout(() => {
        this.tasks.delete(id);
        reject(new Error(`Worker timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.tasks.set(id, task);

      // Add ID to message payload
      if (message.payload) {
        message.payload.id = id;
      }

      // Queue the task
      this.taskQueue.push({ message, task });
      this.processQueue();
    });
  }

  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];

    // Clear all pending tasks
    for (const task of this.tasks.values()) {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error("Worker pool terminated"));
    }
    this.tasks.clear();
  }
}

// Create singleton worker pool
let workerPool: WorkerPool | null = null;

/**
 * Get or create the worker pool.
 */
function getWorkerPool(): WorkerPool {
  if (!workerPool) {
    workerPool = new WorkerPool(
      "../../workers/data-processor.worker.ts",
      navigator.hardwareConcurrency || 4
    );
  }
  return workerPool;
}

/**
 * Parse JSON data using a web worker.
 *
 * @param jsonString JSON string to parse
 * @returns Promise resolving to parsed data
 */
export async function parseJSONInWorker<T = any>(jsonString: string): Promise<T> {
  // For small strings, parse directly
  if (jsonString.length < 10000) {
    return JSON.parse(jsonString);
  }

  const pool = getWorkerPool();
  const result = await pool.execute<{ data: T }>({
    type: "PARSE_JSON",
    payload: { data: jsonString },
  });

  return result.data;
}

/**
 * Transform rankings data using a web worker.
 *
 * @param rankings Rankings data to transform
 * @param options Transformation options
 * @returns Promise resolving to transformed rankings
 */
export async function transformRankingsInWorker(
  rankings: any[],
  options: {
    includeMetrics?: boolean;
    calculateChanges?: boolean;
    limit?: number;
  } = {}
): Promise<any[]> {
  const pool = getWorkerPool();
  return pool.execute({
    type: "TRANSFORM_RANKINGS",
    payload: { rankings, options },
  });
}

/**
 * Calculate metrics using a web worker.
 *
 * @param data Data to analyze
 * @param metrics Metric fields to calculate
 * @returns Promise resolving to calculated metrics
 */
export async function calculateMetricsInWorker(data: any[], metrics: string[]): Promise<any> {
  const pool = getWorkerPool();
  return pool.execute({
    type: "CALCULATE_METRICS",
    payload: { data, metrics },
  });
}

/**
 * Filter and sort data using a web worker.
 *
 * @param data Data to filter and sort
 * @param filter Filter criteria
 * @param sort Sort options
 * @returns Promise resolving to filtered and sorted data
 */
export async function filterAndSortInWorker(
  data: any[],
  filter: {
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "in";
    value: any;
  },
  sort: {
    field: string;
    direction: "asc" | "desc";
  }
): Promise<any[]> {
  const pool = getWorkerPool();
  return pool.execute({
    type: "FILTER_AND_SORT",
    payload: { data, filters: filter, sort },
  });
}

/**
 * Aggregate data using a web worker.
 *
 * @param data Data to aggregate
 * @param groupBy Field to group by
 * @param aggregations Aggregation operations
 * @returns Promise resolving to aggregated data
 */
export async function aggregateDataInWorker(
  data: unknown[],
  groupBy: string,
  aggregations: Record<string, "sum" | "avg" | "min" | "max" | "count">
): Promise<Record<string, unknown>> {
  const pool = getWorkerPool();
  return pool.execute({
    type: "AGGREGATE_DATA",
    payload: { data, groupBy, aggregations },
  });
}

/**
 * Process data in batches using web workers.
 *
 * @param data Data array to process
 * @param batchSize Size of each batch
 * @param processor Function to process each batch
 * @returns Promise resolving to processed results
 */
export async function processBatchesInWorker<T, R>(
  data: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const batches: T[][] = [];

  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  const results = await Promise.all(batches.map((batch) => processor(batch)));

  return results.flat();
}

/**
 * Terminate all workers and clean up resources.
 */
export function terminateWorkers(): void {
  if (workerPool) {
    workerPool.terminate();
    workerPool = null;
  }
}

// Clean up workers on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", terminateWorkers);
}
