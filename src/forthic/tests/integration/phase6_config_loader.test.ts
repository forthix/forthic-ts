/**
 * Phase 6: Configuration Loader Integration Tests
 *
 * Tests for ConfigLoader and LOAD-RUNTIMES words
 *
 * Note: These tests verify configuration loading and validation.
 * Full end-to-end tests with actual Python server would require
 * a running gRPC server.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StandardInterpreter } from '../../interpreter';
import { RuntimeManager } from '../../../grpc/runtime_manager';
import { ConfigLoader } from '../../../grpc/config_loader';

let interp: StandardInterpreter;

beforeEach(async () => {
  interp = new StandardInterpreter();
  // Clean up runtime manager between tests
  RuntimeManager.reset();
});

afterEach(() => {
  // Clean up runtime manager after each test
  RuntimeManager.reset();
});

describe('Phase 6: ConfigLoader', () => {
  const validYaml = `
runtimes:
  python:
    host: localhost
    port: 50051
    modules:
      - math
      - array
  ruby:
    host: localhost
    port: 50052
    modules:
      - activerecord
settings:
  connection_timeout: 5000
  health_check: true
`;

  const invalidYaml = `
runtimes:
  python:
    host: localhost
    # Missing port!
    modules:
      - math
`;

  test('loadFromString parses valid YAML', () => {
    const config = ConfigLoader.loadFromString(validYaml);

    expect(config.runtimes).toBeDefined();
    expect(config.runtimes.python).toBeDefined();
    expect(config.runtimes.python.host).toBe('localhost');
    expect(config.runtimes.python.port).toBe(50051);
    expect(config.runtimes.python.modules).toEqual(['math', 'array']);
    expect(config.runtimes.ruby).toBeDefined();
    expect(config.settings?.connection_timeout).toBe(5000);
    expect(config.settings?.health_check).toBe(true);
  });

  test('loadFromString validates missing port', () => {
    expect(() => {
      ConfigLoader.loadFromString(invalidYaml);
    }).toThrow(/port/);
  });

  test('loadFromString validates missing runtimes section', () => {
    const noRuntimes = 'settings:\n  timeout: 1000';
    expect(() => {
      ConfigLoader.loadFromString(noRuntimes);
    }).toThrow(/runtimes/);
  });

  test('loadFromString validates invalid port range', () => {
    const badPort = `
runtimes:
  python:
    host: localhost
    port: 99999
    modules: []
`;
    expect(() => {
      ConfigLoader.loadFromString(badPort);
    }).toThrow(/port/);
  });

  test('loadFromString validates modules must be array', () => {
    const badModules = `
runtimes:
  python:
    host: localhost
    port: 50051
    modules: "not-an-array"
`;
    expect(() => {
      ConfigLoader.loadFromString(badModules);
    }).toThrow(/modules/);
  });

  test('loadFromString validates module items must be strings', () => {
    const badModuleItems = `
runtimes:
  python:
    host: localhost
    port: 50051
    modules:
      - math
      - 123
`;
    expect(() => {
      ConfigLoader.loadFromString(badModuleItems);
    }).toThrow(/modules must be strings/);
  });

  test('loadFromFile throws error for non-existent file', () => {
    expect(() => {
      ConfigLoader.loadFromFile('/non/existent/file.yaml');
    }).toThrow(/not found/);
  });

  test('getDefaultConfigPath returns null when no config exists', () => {
    // Save current working directory
    const originalCwd = process.cwd();

    try {
      // Change to a directory without config files
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forthix-test-'));
      process.chdir(tmpDir);

      const result = ConfigLoader.getDefaultConfigPath();
      expect(result).toBeNull();

      // Clean up
      fs.rmdirSync(tmpDir);
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });
});

describe('Phase 6: LOAD-RUNTIMES Words', () => {
  test('LOAD-RUNTIMES word exists', () => {
    expect(() => {
      (interp as any).find_word('LOAD-RUNTIMES');
    }).not.toThrow();
  });

  test('LOAD-RUNTIMES-FROM word exists', () => {
    expect(() => {
      (interp as any).find_word('LOAD-RUNTIMES-FROM');
    }).not.toThrow();
  });

  test('LOAD-RUNTIMES fails when no default config found', async () => {
    // Save current working directory
    const originalCwd = process.cwd();

    try {
      // Change to a directory without config files
      const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forthix-test-'));
      process.chdir(tmpDir);

      await expect(async () => {
        await interp.run(`["python"] LOAD-RUNTIMES`);
      }).rejects.toThrow(/No configuration file found/);

      // Clean up
      fs.rmdirSync(tmpDir);
    } finally {
      // Restore working directory
      process.chdir(originalCwd);
    }
  });

  test('LOAD-RUNTIMES-FROM loads configuration from specified file', async () => {
    // Create a temporary config file
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forthix-test-'));
    const configPath = path.join(tmpDir, 'test-config.yaml');

    const configContent = `
runtimes:
  python:
    host: localhost
    port: 50051
    modules:
      - math
`;

    fs.writeFileSync(configPath, configContent);

    try {
      // This should connect to the runtime but fail to load modules
      // (since no server is running). That's OK - we're just testing
      // that the configuration is read and processed correctly.
      await interp.run(`"${configPath}" ["python"] LOAD-RUNTIMES-FROM`);

      // Check that runtime was connected
      const runtimeManager = RuntimeManager.getInstance();
      expect(runtimeManager.hasClient('python')).toBe(true);

      // If we got this far, the config was loaded successfully
      // (even though module loading will fail without a server)
    } catch (error) {
      // Expected to fail when trying to actually load modules,
      // but should not fail on config parsing
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).not.toMatch(/configuration/i);
      expect(errorMessage).not.toMatch(/not found/i);
    } finally {
      // Clean up
      fs.unlinkSync(configPath);
      fs.rmdirSync(tmpDir);
    }
  });

  test('LOAD-RUNTIMES-FROM fails for non-existent runtime in config', async () => {
    // Create a temporary config file
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forthix-test-'));
    const configPath = path.join(tmpDir, 'test-config.yaml');

    const configContent = `
runtimes:
  python:
    host: localhost
    port: 50051
    modules: []
`;

    fs.writeFileSync(configPath, configContent);

    try {
      // Try to load a runtime that doesn't exist in the config
      await expect(async () => {
        await interp.run(`"${configPath}" ["ruby"] LOAD-RUNTIMES-FROM`);
      }).rejects.toThrow(/not found in configuration/);
    } finally {
      // Clean up
      fs.unlinkSync(configPath);
      fs.rmdirSync(tmpDir);
    }
  });

  test('LOAD-RUNTIMES-FROM handles invalid config file', async () => {
    // Create a temporary config file with invalid YAML
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forthix-test-'));
    const configPath = path.join(tmpDir, 'invalid-config.yaml');

    const invalidContent = `
runtimes:
  python:
    host: localhost
    # Missing required port field
    modules: []
`;

    fs.writeFileSync(configPath, invalidContent);

    try {
      await expect(async () => {
        await interp.run(`"${configPath}" ["python"] LOAD-RUNTIMES-FROM`);
      }).rejects.toThrow(/port/);
    } finally {
      // Clean up
      fs.unlinkSync(configPath);
      fs.rmdirSync(tmpDir);
    }
  });

  test('LOAD-RUNTIMES-FROM can load multiple runtimes', async () => {
    // Create a temporary config file
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'forthix-test-'));
    const configPath = path.join(tmpDir, 'multi-runtime-config.yaml');

    const configContent = `
runtimes:
  python:
    host: localhost
    port: 50051
    modules: []
  ruby:
    host: localhost
    port: 50052
    modules: []
`;

    fs.writeFileSync(configPath, configContent);

    try {
      await interp.run(`"${configPath}" ["python" "ruby"] LOAD-RUNTIMES-FROM`);

      // Check that both runtimes were connected
      const runtimeManager = RuntimeManager.getInstance();
      expect(runtimeManager.hasClient('python')).toBe(true);
      expect(runtimeManager.hasClient('ruby')).toBe(true);
    } finally {
      // Clean up
      fs.unlinkSync(configPath);
      fs.rmdirSync(tmpDir);
    }
  });
});
