/**
 * Rich error handling for multi-runtime execution
 * Custom error classes that preserve context across runtime boundaries
 */

/**
 * Error information from a remote runtime
 */
export interface RemoteErrorInfo {
  message: string;
  runtime: string;
  stackTrace: string[];
  errorType: string;
  wordLocation?: string;
  moduleName?: string;
  context: Record<string, string>;
}

/**
 * Custom error class for errors that occur in remote runtimes
 * Preserves stack trace and context from the remote runtime
 */
export class RemoteRuntimeError extends Error {
  public readonly runtime: string;
  public readonly remoteStackTrace: string[];
  public readonly errorType: string;
  public readonly wordLocation?: string;
  public readonly moduleName?: string;
  public readonly context: Record<string, string>;

  constructor(errorInfo: RemoteErrorInfo) {
    // Build a rich error message
    let message = `Error in ${errorInfo.runtime} runtime: ${errorInfo.message}`;

    if (errorInfo.moduleName) {
      message += `\n  Module: ${errorInfo.moduleName}`;
    }

    if (errorInfo.wordLocation) {
      message += `\n  Location: ${errorInfo.wordLocation}`;
    }

    if (Object.keys(errorInfo.context).length > 0) {
      message += '\n  Context:';
      for (const [key, value] of Object.entries(errorInfo.context)) {
        message += `\n    ${key}: ${value}`;
      }
    }

    super(message);

    this.name = 'RemoteRuntimeError';
    this.runtime = errorInfo.runtime;
    this.remoteStackTrace = errorInfo.stackTrace;
    this.errorType = errorInfo.errorType;
    this.wordLocation = errorInfo.wordLocation;
    this.moduleName = errorInfo.moduleName;
    this.context = errorInfo.context;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, RemoteRuntimeError.prototype);
  }

  /**
   * Get the full stack trace including both local and remote context
   */
  getFullStackTrace(): string {
    let result = `${this.name}: ${this.message}\n`;

    // Add local TypeScript stack
    if (this.stack) {
      result += '\nLocal stack (TypeScript):\n';
      result += this.stack;
    }

    // Add remote stack trace
    if (this.remoteStackTrace && this.remoteStackTrace.length > 0) {
      result += `\n\nRemote stack (${this.runtime}):\n`;
      result += this.remoteStackTrace.join('\n');
    }

    return result;
  }

  /**
   * Get a formatted error report with all available context
   */
  getErrorReport(): string {
    let report = '═'.repeat(80) + '\n';
    report += `REMOTE RUNTIME ERROR\n`;
    report += '═'.repeat(80) + '\n\n';

    report += `Runtime: ${this.runtime}\n`;
    report += `Error Type: ${this.errorType}\n`;
    report += `Message: ${this.message}\n`;

    if (this.moduleName) {
      report += `Module: ${this.moduleName}\n`;
    }

    if (this.wordLocation) {
      report += `Location: ${this.wordLocation}\n`;
    }

    if (Object.keys(this.context).length > 0) {
      report += '\nContext:\n';
      for (const [key, value] of Object.entries(this.context)) {
        report += `  ${key}: ${value}\n`;
      }
    }

    report += '\n' + '─'.repeat(80) + '\n';
    report += 'Stack Trace:\n';
    report += '─'.repeat(80) + '\n';

    if (this.remoteStackTrace && this.remoteStackTrace.length > 0) {
      report += this.remoteStackTrace.join('\n');
    }

    report += '\n' + '═'.repeat(80) + '\n';

    return report;
  }

  /**
   * Convert to a plain object for serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      runtime: this.runtime,
      errorType: this.errorType,
      remoteStackTrace: this.remoteStackTrace,
      wordLocation: this.wordLocation,
      moduleName: this.moduleName,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Parse ErrorInfo from protobuf response into RemoteErrorInfo
 */
export function parseErrorInfo(errorInfo: any): RemoteErrorInfo {
  return {
    message: errorInfo.message || 'Unknown error',
    runtime: errorInfo.runtime || 'unknown',
    stackTrace: errorInfo.stack_trace || [],
    errorType: errorInfo.error_type || 'Error',
    wordLocation: errorInfo.word_location || undefined,
    moduleName: errorInfo.module_name || undefined,
    context: errorInfo.context || {},
  };
}
