/**
 * Example 05: Running TypeScript as a JSON-RPC Server
 *
 * This example shows how to expose your TypeScript runtime to other Forthic
 * runtimes (Python, Ruby, etc.) via JSON-RPC over HTTP. Other runtimes can
 * then call TypeScript-specific modules like 'fs' remotely.
 *
 * Use case: You have Node.js file system operations that you want to use
 * from a Python data science workflow.
 */

import { startJsonRpcServer } from '@forthix/forthic/jsonrpc';

async function main() {
  console.log('Starting TypeScript Forthic JSON-RPC server...\n');

  const PORT = 8765;

  // Binds 127.0.0.1 by default: reachable from this machine only. To accept
  // remote connections, pass { host: '0.0.0.0', token: <secret> } — never
  // bind a public interface without a token.
  const server = await startJsonRpcServer(PORT);

  console.log(`✅ JSON-RPC server running on http://127.0.0.1:${PORT}/rpc`);
  console.log('\nAvailable runtime-specific modules:');
  console.log('  - fs: File system operations (READ-FILE, WRITE-FILE, etc.)\n');
  console.log('Other runtimes can now connect and use these modules!\n');

  console.log('Example from Python:');
  console.log('```python');
  console.log('from forthic.jsonrpc import JsonRpcClient, RemoteModule');
  console.log('');
  console.log("client = JsonRpcClient('localhost:8765')");
  console.log("fs_module = RemoteModule('fs', client, 'typescript')");
  console.log('await fs_module.initialize()');
  console.log('interp.register_module(fs_module)');
  console.log('');
  console.log('# Now you can use the TypeScript fs module from Python!');
  console.log("await interp.run('\"package.json\" READ-FILE')");
  console.log('```\n');

  console.log('Press Ctrl+C to stop the server.');

  process.on('SIGINT', () => {
    console.log('\n\nShutting down JSON-RPC server...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
