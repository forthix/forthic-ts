/**
 * Unit tests for WebSocket error handling
 */
import { RemoteRuntimeError, type RemoteErrorInfo } from '../../../../websocket/errors.js';

describe('RemoteRuntimeError', () => {
  test('creates error with basic info', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Word not found',
      error_type: 'WordNotFoundError',
    };

    const error = new RemoteRuntimeError(errorInfo);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RemoteRuntimeError);
    expect(error.name).toBe('RemoteRuntimeError');
    expect(error.message).toContain('Remote runtime error: Word not found');
    expect(error.errorType).toBe('WordNotFoundError');
    expect(error.remoteStackTrace).toEqual([]);
    expect(error.context).toEqual({});
  });

  test('creates error with full context', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Division by zero',
      error_type: 'ZeroDivisionError',
      stack_trace: ['line 1', 'line 2', 'line 3'],
      module_name: 'math',
      context: {
        word: 'DIVIDE',
        stack_size: '2',
      },
    };

    const error = new RemoteRuntimeError(errorInfo);

    expect(error.message).toContain('Division by zero');
    expect(error.message).toContain('Module: math');
    expect(error.message).toContain('Context:');
    expect(error.message).toContain('word: DIVIDE');
    expect(error.errorType).toBe('ZeroDivisionError');
    expect(error.remoteStackTrace).toEqual(['line 1', 'line 2', 'line 3']);
    expect(error.moduleName).toBe('math');
    expect(error.context).toEqual({
      word: 'DIVIDE',
      stack_size: '2',
    });
  });

  test('getFullStackTrace includes both local and remote stacks', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Test error',
      error_type: 'TestError',
      stack_trace: ['remote line 1', 'remote line 2'],
    };

    const error = new RemoteRuntimeError(errorInfo);
    const fullStack = error.getFullStackTrace();

    expect(fullStack).toContain('RemoteRuntimeError');
    expect(fullStack).toContain('Test error');
    expect(fullStack).toContain('Local stack (TypeScript)');
    expect(fullStack).toContain('Remote stack:');
    expect(fullStack).toContain('remote line 1');
    expect(fullStack).toContain('remote line 2');
  });

  test('getErrorReport formats error nicely', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Test error',
      error_type: 'TestError',
      stack_trace: ['trace line 1', 'trace line 2'],
      module_name: 'test_module',
      context: {
        key1: 'value1',
        key2: 'value2',
      },
    };

    const error = new RemoteRuntimeError(errorInfo);
    const report = error.getErrorReport();

    expect(report).toContain('REMOTE RUNTIME ERROR');
    expect(report).toContain('Error Type: TestError');
    expect(report).toContain('Message:');
    expect(report).toContain('Module: test_module');
    expect(report).toContain('Context:');
    expect(report).toContain('key1: value1');
    expect(report).toContain('key2: value2');
    expect(report).toContain('Stack Trace:');
    expect(report).toContain('trace line 1');
    expect(report).toContain('trace line 2');
  });

  test('toJSON serializes error correctly', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Test error',
      error_type: 'TestError',
      stack_trace: ['line 1'],
      module_name: 'test',
      context: { key: 'value' },
    };

    const error = new RemoteRuntimeError(errorInfo);
    const json = error.toJSON();

    expect(json.name).toBe('RemoteRuntimeError');
    expect(json.message).toContain('Test error');
    expect(json.errorType).toBe('TestError');
    expect(json.remoteStackTrace).toEqual(['line 1']);
    expect(json.moduleName).toBe('test');
    expect(json.context).toEqual({ key: 'value' });
    expect(json.stack).toBeDefined();
  });

  test('handles missing optional fields', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Simple error',
    };

    const error = new RemoteRuntimeError(errorInfo);

    expect(error.message).toBe('Remote runtime error: Simple error');
    expect(error.errorType).toBe('Error');
    expect(error.remoteStackTrace).toEqual([]);
    expect(error.moduleName).toBeUndefined();
    expect(error.context).toEqual({});
  });

  test('instanceof check works correctly', () => {
    const errorInfo: RemoteErrorInfo = {
      message: 'Test',
    };

    const error = new RemoteRuntimeError(errorInfo);

    expect(error instanceof RemoteRuntimeError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
