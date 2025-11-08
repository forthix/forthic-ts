/**
 * RemoteRuntimeModule - Forthic module for managing remote runtime connections
 *
 * Provides words to connect to remote runtimes and load their modules:
 * - CONNECT-RUNTIME: Establish connection to a remote runtime
 * - USE-PY-MODULES: Load Python modules from connected runtime
 * - USE-PY-MODULES-AS: Load Python modules with a prefix
 * - LOAD-RUNTIMES: Load runtimes from YAML configuration (Phase 6)
 */
import { DecoratedModule, ForthicWord, registerModuleDoc } from '../forthic/decorators/word.js';
import { RuntimeManager } from './runtime_manager.js';
import { RemoteModule } from './remote_module.js';
import { ConfigLoader } from './config_loader.js';

export class RemoteRuntimeModule extends DecoratedModule {
  static {
    registerModuleDoc(
      RemoteRuntimeModule,
      `
Remote runtime management for multi-language execution.

## Categories
- Connection: CONNECT-RUNTIME
- Module Loading: USE-PY-MODULES, USE-PY-MODULES-AS
- Configuration: LOAD-RUNTIMES

## Examples
# Manual connection
"python" "localhost:50051" CONNECT-RUNTIME
["math" "array"] USE-PY-MODULES

# Load with prefix
["pandas"] "py" USE-PY-MODULES-AS

# Configuration-based loading (Phase 6)
["python"] LOAD-RUNTIMES
# Or load from specific file:
"./config/runtimes.yaml" ["python"] LOAD-RUNTIMES-FROM
    `
    );
  }

  constructor() {
    super('remote_runtime');
  }

  @ForthicWord(
    '( runtime_name:string address:string -- )',
    'Connect to a remote runtime. Example: "python" "localhost:50051" CONNECT-RUNTIME'
  )
  async ['CONNECT-RUNTIME'](runtime_name: string, address: string) {
    const runtimeManager = RuntimeManager.getInstance();

    // Check if already connected
    if (runtimeManager.hasClient(runtime_name)) {
      throw new Error(
        `Runtime '${runtime_name}' is already connected. Use a different name or disconnect first.`
      );
    }

    // Connect to the runtime
    runtimeManager.connectRuntime(runtime_name, address);
  }

  @ForthicWord(
    '( module_names:string[] -- )',
    'Load Python modules from connected python runtime. Example: ["math" "array"] USE-PY-MODULES'
  )
  async ['USE-PY-MODULES'](module_names: string[]) {
    await this.loadRemoteModules(module_names, 'python', '');
  }

  @ForthicWord(
    '( module_names:string[] prefix:string -- )',
    'Load Python modules with prefix. Example: ["pandas"] "py" USE-PY-MODULES-AS'
  )
  async ['USE-PY-MODULES-AS'](module_names: string[], prefix: string) {
    await this.loadRemoteModules(module_names, 'python', prefix);
  }

  @ForthicWord(
    '( runtime_names:string[] -- )',
    'Load runtimes from default configuration file (forthic-runtimes.yaml). Example: ["python"] LOAD-RUNTIMES'
  )
  async ['LOAD-RUNTIMES'](runtime_names: string[]) {
    // Find default configuration file
    const configPath = ConfigLoader.getDefaultConfigPath();
    if (!configPath) {
      throw new Error(
        'No configuration file found. Looking for forthic-runtimes.yaml in current directory.'
      );
    }

    await this.loadRuntimesFromFile(configPath, runtime_names);
  }

  @ForthicWord(
    '( config_path:string runtime_names:string[] -- )',
    'Load runtimes from specified configuration file. Example: "./config.yaml" ["python"] LOAD-RUNTIMES-FROM'
  )
  async ['LOAD-RUNTIMES-FROM'](config_path: string, runtime_names: string[]) {
    await this.loadRuntimesFromFile(config_path, runtime_names);
  }

  /**
   * Helper method to load runtimes from a configuration file
   *
   * @param configPath - Path to the configuration file
   * @param runtimeNames - Array of runtime names to load
   */
  private async loadRuntimesFromFile(configPath: string, runtimeNames: string[]): Promise<void> {
    // Load configuration
    const config = ConfigLoader.loadFromFile(configPath);

    // Load each requested runtime
    for (const runtimeName of runtimeNames) {
      // Check if runtime exists in config
      if (!config.runtimes[runtimeName]) {
        throw new Error(
          `Runtime '${runtimeName}' not found in configuration. Available runtimes: ${Object.keys(config.runtimes).join(', ')}`
        );
      }

      const runtimeConfig = config.runtimes[runtimeName];

      // Connect to the runtime
      const address = `${runtimeConfig.host}:${runtimeConfig.port}`;
      const runtimeManager = RuntimeManager.getInstance();

      // Only connect if not already connected
      if (!runtimeManager.hasClient(runtimeName)) {
        runtimeManager.connectRuntime(runtimeName, address);
      }

      // Load modules specified in configuration
      if (runtimeConfig.modules && runtimeConfig.modules.length > 0) {
        await this.loadRemoteModules(runtimeConfig.modules, runtimeName, '');
      }
    }
  }

  /**
   * Helper method to load remote modules
   *
   * @param moduleNames - Array of module names to load
   * @param runtimeName - Name of the runtime (e.g., "python")
   * @param prefix - Prefix for imported words (empty string for no prefix)
   */
  private async loadRemoteModules(
    moduleNames: string[],
    runtimeName: string,
    prefix: string
  ): Promise<void> {
    const runtimeManager = RuntimeManager.getInstance();
    const client = runtimeManager.getClient(runtimeName);

    if (!client) {
      throw new Error(
        `Runtime '${runtimeName}' is not connected. Use CONNECT-RUNTIME first.`
      );
    }

    // Load each module
    for (const moduleName of moduleNames) {
      // Create RemoteModule
      const remoteModule = new RemoteModule(moduleName, client, runtimeName);

      // Initialize (discovers words from remote runtime)
      await remoteModule.initialize();

      // Register with interpreter
      this.interp.register_module(remoteModule);

      // Use the module with the specified prefix
      // If prefix is empty, use unprefixed import
      if (prefix === '') {
        this.interp.use_modules([moduleName]);
      } else {
        this.interp.use_modules([[moduleName, prefix]]);
      }
    }
  }
}
