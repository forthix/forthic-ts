/**
 * Example 06: Calling Remote Runtimes via gRPC
 *
 * This example shows how to connect to other Forthic runtimes (Python, Ruby, etc.)
 * and call their runtime-specific modules from TypeScript.
 *
 * Use case: You want to use Python's pandas library from your TypeScript application
 * without reimplementing data analysis logic.
 *
 * Prerequisites:
 * 1. Start a Python gRPC server exposing the pandas module:
 *    ```bash
 *    # In Python forthic runtime
 *    forthic-server --port 50051 --modules pandas
 *    ```
 *
 * 2. Run this example:
 *    ```bash
 *    npx tsx examples/06-grpc-client.ts
 *    ```
 */

import { Interpreter } from '@forthix/forthic';
import { GrpcClient, RemoteModule } from '@forthix/forthic/grpc';

async function main() {
  console.log('Example: Calling Python pandas module from TypeScript\n');

  // Connect to Python runtime
  console.log('1. Connecting to Python runtime at localhost:50051...');
  const pythonClient = new GrpcClient('localhost:50051');

  // Discover available modules
  console.log('2. Discovering available modules...');
  const modules = await pythonClient.listModules();
  console.log('   Available modules:', modules.map((m) => m.name).join(', '));

  // Check if pandas is available
  const pandasAvailable = modules.some((m) => m.name === 'pandas');
  if (!pandasAvailable) {
    console.log('\n⚠️  pandas module not found on Python server.');
    console.log('   Make sure the Python server is running with pandas module enabled.');
    console.log('   Example: forthic-server --port 50051 --modules pandas\n');
    pythonClient.close();
    return;
  }

  // Create remote module for pandas
  console.log('3. Initializing pandas remote module...');
  const pandas = new RemoteModule('pandas', pythonClient, 'python');
  await pandas.initialize();
  console.log(`   Discovered ${pandas.getWordCount()} pandas words\n`);

  // Register with interpreter
  const interp = new Interpreter();
  interp.register_module(pandas);

  // Example 1: Create DataFrame from records
  console.log('4. Example: Creating DataFrame from records');
  await interp.run(`
    ["pandas"] USE-MODULES

    # Create array of records
    [
      [["name" "Alice"] ["age" 30] ["city" "NYC"]] REC
      [["name" "Bob"] ["age" 25] ["city" "LA"]] REC
      [["name" "Carol"] ["age" 35] ["city" "Chicago"]] REC
    ]

    # Convert to pandas DataFrame (runs in Python!)
    DF-FROM-RECORDS
  `);

  const df = interp.stack_pop();
  console.log('   Created DataFrame:', df);
  console.log('   ✅ Success! DataFrame created in Python and returned to TypeScript\n');

  // Example 2: Execute word directly
  console.log('5. Example: Calling Python word directly via client');
  const stack = [
    [1, 2, 3, 4, 5],
    '2 *', // Multiply each by 2
  ];
  const result = await pythonClient.executeWord('MAP', stack);
  console.log('   Input stack:', stack);
  console.log('   Result:', result);
  console.log('   ✅ Array transformation executed in Python\n');

  // Example 3: Get module info
  console.log('6. Module introspection:');
  const moduleInfo = await pythonClient.getModuleInfo('pandas');
  console.log(`   Module: ${moduleInfo.name}`);
  console.log(`   Description: ${moduleInfo.description}`);
  console.log(`   Words (first 5):`);
  moduleInfo.words.slice(0, 5).forEach((word) => {
    console.log(`     - ${word.name} ${word.stack_effect}`);
    console.log(`       ${word.description}`);
  });

  // Clean up
  pythonClient.close();
  console.log('\n✨ Done! TypeScript successfully called Python runtime via gRPC.');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  1. Is the Python gRPC server running?');
  console.error('     Command: forthic-server --port 50051 --modules pandas');
  console.error('  2. Is pandas module available in Python runtime?');
  console.error('  3. Is port 50051 accessible?');
  process.exit(1);
});
