/**
 * Example 06: Calling Remote Runtimes via JSON-RPC
 *
 * This example shows how to connect to other Forthic runtimes (Python, Ruby, etc.)
 * and call their runtime-specific modules from TypeScript.
 *
 * Use case: You want to use Python's pandas library from your TypeScript application
 * without reimplementing data analysis logic.
 *
 * Prerequisites:
 * 1. Start a Python JSON-RPC server exposing the pandas module:
 *    ```bash
 *    # In the Python forthic runtime
 *    forthic-server --port 8765 --modules pandas
 *    ```
 *
 * 2. Run this example:
 *    ```bash
 *    npx tsx examples/06-jsonrpc-client.ts
 *    ```
 */

import { Interpreter } from '@forthix/forthic';
import { JsonRpcClient, RemoteModule } from '@forthix/forthic/jsonrpc';

async function main() {
  console.log('Example: Calling the Python pandas module from TypeScript\n');

  // Connect to the Python runtime ("host:port" becomes http://host:port/rpc)
  console.log('1. Connecting to Python runtime at localhost:8765...');
  const pythonClient = new JsonRpcClient('localhost:8765');

  console.log('2. Discovering available modules...');
  const modules = await pythonClient.listModules();
  console.log('   Available modules:', modules.map((m) => m.name).join(', '));

  const pandasAvailable = modules.some((m) => m.name === 'pandas');
  if (!pandasAvailable) {
    console.log('\n⚠️  pandas module not found on the Python server.');
    console.log('   Start it with: forthic-server --port 8765 --modules pandas\n');
    pythonClient.close();
    return;
  }

  console.log('3. Initializing the pandas remote module...');
  const pandas = new RemoteModule('pandas', pythonClient, 'python');
  await pandas.initialize();
  console.log(`   Discovered ${pandas.getWordCount()} pandas words\n`);

  const interp = new Interpreter();
  interp.register_module(pandas);

  // Example 1: build a DataFrame from records
  console.log('4. Example: creating a DataFrame from records');
  await interp.run(`
    ["pandas"] USE-MODULES

    # Create an array of records
    [
      [["name" "Alice"] ["age" 30] ["city" "NYC"]] REC
      [["name" "Bob"] ["age" 25] ["city" "LA"]] REC
      [["name" "Carol"] ["age" 35] ["city" "Chicago"]] REC
    ]

    # Convert to a pandas DataFrame (runs in Python!)
    DF-FROM-RECORDS
  `);

  const df = interp.stack_pop();
  console.log('   Created DataFrame:', df);
  console.log('   ✅ DataFrame created in Python and returned to TypeScript\n');

  // Example 2: call a word directly through the client
  console.log('5. Example: calling a Python word directly via the client');
  const stack = [
    [1, 2, 3, 4, 5],
    '2 *', // Multiply each by 2
  ];
  const result = await pythonClient.executeWord('MAP', stack);
  console.log('   Input stack:', stack);
  console.log('   Result:', result);
  console.log('   ✅ Array transformation executed in Python\n');

  // Example 3: module introspection
  console.log('6. Module introspection:');
  const moduleInfo = await pythonClient.getModuleInfo('pandas');
  console.log(`   Module: ${moduleInfo.name}`);
  console.log(`   Description: ${moduleInfo.description}`);
  console.log(`   Words (first 5):`);
  moduleInfo.words.slice(0, 5).forEach((word) => {
    console.log(`     - ${word.name} ${word.stack_effect}`);
    console.log(`       ${word.description}`);
  });

  pythonClient.close();
  console.log('\n✨ Done! TypeScript successfully called the Python runtime via JSON-RPC.');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error('\nTroubleshooting:');
  console.error('  1. Is the Python JSON-RPC server running?');
  console.error('     Command: forthic-server --port 8765 --modules pandas');
  console.error('  2. Is the pandas module available in the Python runtime?');
  console.error('  3. Is port 8765 reachable? (servers bind loopback by default)');
  process.exit(1);
});
