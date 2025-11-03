/**
 * ExecutionPlanner - Optimizes word execution by batching remote calls
 *
 * Analyzes sequences of words and groups them into execution batches to minimize
 * cross-runtime RPC overhead. Standard library words are included in remote batches
 * since they're available in all runtimes.
 *
 * Example optimization:
 *   Before: PY-WORD-1 + * PY-WORD-2 → 4 executions (1 remote, 2 local, 1 remote)
 *   After:  PY-WORD-1 + * PY-WORD-2 → 1 batch of 4 words executed remotely
 */
import { Word, RuntimeInfo } from './module.js';

/**
 * ExecutionBatch - A group of words that can be executed together
 */
export interface ExecutionBatch {
  runtime: string;          // "local" | "python" | "ruby" | etc.
  words: Word[];           // Words in this batch
  startIndex: number;      // Starting index in original word sequence
  endIndex: number;        // Ending index in original word sequence
  isRemote: boolean;       // True if this batch requires remote execution
}

/**
 * ExecutionPlanner - Analyzes and optimizes word execution sequences
 */
export class ExecutionPlanner {
  /**
   * Plan execution by grouping words into efficient batches
   *
   * Algorithm:
   * 1. Iterate through words, building batches
   * 2. For each word, check if it can extend the current batch
   * 3. Standard library words can join remote batches (they exist in all runtimes)
   * 4. Runtime-specific words start new batches if runtime changes
   *
   * @param words - Sequence of words to execute
   * @returns Array of execution batches
   */
  planExecution(words: Word[]): ExecutionBatch[] {
    if (words.length === 0) {
      return [];
    }

    const batches: ExecutionBatch[] = [];
    let currentBatch: ExecutionBatch | null = null;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const info = word.getRuntimeInfo();

      if (currentBatch === null) {
        // Start first batch
        currentBatch = this.createBatch(info, word, i);
      } else if (this.canExtendBatch(currentBatch, info)) {
        // Add word to current batch
        currentBatch.words.push(word);
        currentBatch.endIndex = i;
      } else {
        // Close current batch and start new one
        batches.push(currentBatch);
        currentBatch = this.createBatch(info, word, i);
      }
    }

    // Don't forget the last batch
    if (currentBatch !== null) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Check if a word can be added to the current batch
   *
   * Rules:
   * 1. Local batch: Only accept non-remote words
   * 2. Remote batch: Accept words from same runtime OR standard library words
   *
   * @param batch - Current execution batch
   * @param wordInfo - Runtime info for the word we're considering adding
   * @returns True if word can extend the batch
   */
  private canExtendBatch(batch: ExecutionBatch, wordInfo: RuntimeInfo): boolean {
    // Local batch: only accept non-remote words
    if (!batch.isRemote) {
      return !wordInfo.isRemote;
    }

    // Remote batch: accept same runtime or standard library words
    if (wordInfo.runtime === batch.runtime) {
      return true;  // Same runtime
    }

    if (wordInfo.isStandard && wordInfo.availableIn.includes(batch.runtime)) {
      return true;  // Standard word available in batch's runtime
    }

    return false;  // Different runtime, can't extend
  }

  /**
   * Create a new execution batch starting with a word
   *
   * @param info - Runtime info for the first word
   * @param word - The first word in the batch
   * @param index - Index of the word in the sequence
   * @returns New execution batch
   */
  private createBatch(info: RuntimeInfo, word: Word, index: number): ExecutionBatch {
    return {
      runtime: info.isRemote ? info.runtime : "local",
      words: [word],
      startIndex: index,
      endIndex: index,
      isRemote: info.isRemote
    };
  }

  /**
   * Get statistics about the execution plan (for debugging/profiling)
   *
   * @param batches - Execution batches
   * @returns Statistics object
   */
  getStatistics(batches: ExecutionBatch[]): {
    totalBatches: number;
    localBatches: number;
    remoteBatches: number;
    averageBatchSize: number;
    runtimeBreakdown: { [runtime: string]: number };
  } {
    const stats = {
      totalBatches: batches.length,
      localBatches: 0,
      remoteBatches: 0,
      averageBatchSize: 0,
      runtimeBreakdown: {} as { [runtime: string]: number }
    };

    let totalWords = 0;

    for (const batch of batches) {
      if (batch.isRemote) {
        stats.remoteBatches++;
      } else {
        stats.localBatches++;
      }

      totalWords += batch.words.length;

      if (!stats.runtimeBreakdown[batch.runtime]) {
        stats.runtimeBreakdown[batch.runtime] = 0;
      }
      stats.runtimeBreakdown[batch.runtime]++;
    }

    stats.averageBatchSize = batches.length > 0 ? totalWords / batches.length : 0;

    return stats;
  }
}
