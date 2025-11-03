/**
 * Phase 6: ConfigLoader - Parse and validate YAML configuration for runtime setup
 *
 * Loads forthic-runtimes.yaml configuration files and validates the schema.
 */
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

/**
 * Configuration for a single runtime
 */
export interface RuntimeConfig {
  host: string;
  port: number;
  modules: string[];
}

/**
 * Connection settings
 */
export interface ConnectionSettings {
  connection_timeout?: number;
  health_check?: boolean;
}

/**
 * Complete configuration structure
 */
export interface ForthicRuntimesConfig {
  runtimes: Record<string, RuntimeConfig>;
  settings?: ConnectionSettings;
}

/**
 * ConfigLoader - Loads and validates runtime configuration from YAML files
 */
export class ConfigLoader {
  /**
   * Load configuration from a YAML file
   *
   * @param filePath - Path to the YAML configuration file
   * @returns Parsed and validated configuration
   * @throws Error if file not found or configuration is invalid
   */
  static loadFromFile(filePath: string): ForthicRuntimesConfig {
    // Resolve the file path
    const resolvedPath = path.resolve(filePath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    // Read the file
    const fileContent = fs.readFileSync(resolvedPath, 'utf-8');

    // Parse YAML
    let config: any;
    try {
      config = YAML.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Validate configuration
    ConfigLoader.validateConfig(config);

    return config as ForthicRuntimesConfig;
  }

  /**
   * Load configuration from a string
   *
   * @param yamlContent - YAML content as string
   * @returns Parsed and validated configuration
   * @throws Error if configuration is invalid
   */
  static loadFromString(yamlContent: string): ForthicRuntimesConfig {
    // Parse YAML
    let config: any;
    try {
      config = YAML.parse(yamlContent);
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Validate configuration
    ConfigLoader.validateConfig(config);

    return config as ForthicRuntimesConfig;
  }

  /**
   * Validate the configuration structure
   *
   * @param config - Configuration object to validate
   * @throws Error if configuration is invalid
   */
  private static validateConfig(config: any): void {
    // Check top-level structure
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    // Check runtimes section
    if (!config.runtimes || typeof config.runtimes !== 'object') {
      throw new Error('Configuration must have a "runtimes" section');
    }

    // Validate each runtime
    for (const [runtimeName, runtimeConfig] of Object.entries(config.runtimes)) {
      ConfigLoader.validateRuntimeConfig(runtimeName, runtimeConfig);
    }

    // Validate settings if present
    if (config.settings !== undefined) {
      ConfigLoader.validateSettings(config.settings);
    }
  }

  /**
   * Validate a single runtime configuration
   *
   * @param runtimeName - Name of the runtime
   * @param runtimeConfig - Runtime configuration to validate
   * @throws Error if runtime configuration is invalid
   */
  private static validateRuntimeConfig(runtimeName: string, runtimeConfig: any): void {
    if (!runtimeConfig || typeof runtimeConfig !== 'object') {
      throw new Error(`Runtime "${runtimeName}" configuration must be an object`);
    }

    // Validate host
    if (typeof runtimeConfig.host !== 'string' || runtimeConfig.host.length === 0) {
      throw new Error(`Runtime "${runtimeName}" must have a valid "host" string`);
    }

    // Validate port
    if (typeof runtimeConfig.port !== 'number' || runtimeConfig.port <= 0 || runtimeConfig.port > 65535) {
      throw new Error(`Runtime "${runtimeName}" must have a valid "port" number (1-65535)`);
    }

    // Validate modules
    if (!Array.isArray(runtimeConfig.modules)) {
      throw new Error(`Runtime "${runtimeName}" must have a "modules" array`);
    }

    for (const module of runtimeConfig.modules) {
      if (typeof module !== 'string') {
        throw new Error(`Runtime "${runtimeName}" modules must be strings`);
      }
    }
  }

  /**
   * Validate connection settings
   *
   * @param settings - Settings to validate
   * @throws Error if settings are invalid
   */
  private static validateSettings(settings: any): void {
    if (typeof settings !== 'object') {
      throw new Error('Settings must be an object');
    }

    // Validate connection_timeout if present
    if (settings.connection_timeout !== undefined) {
      if (typeof settings.connection_timeout !== 'number' || settings.connection_timeout <= 0) {
        throw new Error('connection_timeout must be a positive number');
      }
    }

    // Validate health_check if present
    if (settings.health_check !== undefined) {
      if (typeof settings.health_check !== 'boolean') {
        throw new Error('health_check must be a boolean');
      }
    }
  }

  /**
   * Get the default configuration file path
   * Looks for forthic-runtimes.yaml in the current directory
   *
   * @returns Path to default config file or null if not found
   */
  static getDefaultConfigPath(): string | null {
    const defaultPaths = [
      './forthic-runtimes.yaml',
      './forthic-runtimes.yml',
      path.join(process.cwd(), 'forthic-runtimes.yaml'),
      path.join(process.cwd(), 'forthic-runtimes.yml'),
    ];

    for (const configPath of defaultPaths) {
      if (fs.existsSync(configPath)) {
        return path.resolve(configPath);
      }
    }

    return null;
  }
}
