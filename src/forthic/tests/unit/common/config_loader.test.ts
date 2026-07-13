/**
 * ConfigLoader - parses and validates forthic-runtimes.yaml.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigLoader } from '../../../../common/config_loader';

describe('ConfigLoader', () => {
  const validYaml = `
runtimes:
  python:
    host: localhost
    port: 8765
    transport: jsonrpc
    modules:
      - math
      - array
  ruby:
    host: localhost
    port: 8766
    modules:
      - activerecord
settings:
  connection_timeout: 5000
  health_check: true
`;

  test('loadFromString parses valid YAML', () => {
    const config = ConfigLoader.loadFromString(validYaml);

    expect(config.runtimes.python).toBeDefined();
    expect(config.runtimes.python.host).toBe('localhost');
    expect(config.runtimes.python.port).toBe(8765);
    expect(config.runtimes.python.transport).toBe('jsonrpc');
    expect(config.runtimes.python.modules).toEqual(['math', 'array']);
    expect(config.runtimes.ruby).toBeDefined();
    expect(config.settings?.connection_timeout).toBe(5000);
    expect(config.settings?.health_check).toBe(true);
  });

  test('loadFromString validates missing port', () => {
    const missingPort = `
runtimes:
  python:
    host: localhost
    modules:
      - math
`;
    expect(() => ConfigLoader.loadFromString(missingPort)).toThrow(/port/);
  });

  test('loadFromString validates missing runtimes section', () => {
    expect(() => ConfigLoader.loadFromString('settings:\n  timeout: 1000')).toThrow(/runtimes/);
  });

  test('loadFromString validates invalid port range', () => {
    const badPort = `
runtimes:
  python:
    host: localhost
    port: 99999
    modules: []
`;
    expect(() => ConfigLoader.loadFromString(badPort)).toThrow(/port/);
  });

  test('loadFromString validates modules must be array', () => {
    const badModules = `
runtimes:
  python:
    host: localhost
    port: 8765
    modules: "not-an-array"
`;
    expect(() => ConfigLoader.loadFromString(badModules)).toThrow(/modules/);
  });

  test('loadFromString validates module items must be strings', () => {
    const badModuleItems = `
runtimes:
  python:
    host: localhost
    port: 8765
    modules:
      - math
      - 123
`;
    expect(() => ConfigLoader.loadFromString(badModuleItems)).toThrow(/modules must be strings/);
  });

  test('transport may be omitted', () => {
    const noTransport = `
runtimes:
  python:
    host: localhost
    port: 8765
    modules: []
`;
    expect(() => ConfigLoader.loadFromString(noTransport)).not.toThrow();
  });

  test('the removed grpc transport is rejected with a migration hint', () => {
    const grpcTransport = `
runtimes:
  python:
    host: localhost
    port: 50051
    transport: grpc
    modules: []
`;
    expect(() => ConfigLoader.loadFromString(grpcTransport)).toThrow(/removed in v0\.16\.0.*jsonrpc/s);
  });

  test('an unknown transport is rejected', () => {
    const bogusTransport = `
runtimes:
  python:
    host: localhost
    port: 8765
    transport: carrier-pigeon
    modules: []
`;
    expect(() => ConfigLoader.loadFromString(bogusTransport)).toThrow(/must be "jsonrpc"/);
  });

  test('loadFromFile throws for a non-existent file', () => {
    expect(() => ConfigLoader.loadFromFile('/non/existent/file.yaml')).toThrow(/not found/);
  });

  test('getDefaultConfigPath returns null when no config exists', () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forthix-test-'));

    try {
      process.chdir(tmpDir);
      expect(ConfigLoader.getDefaultConfigPath()).toBeNull();
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
