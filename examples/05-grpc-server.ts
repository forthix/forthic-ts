/**
 * Example 05: Running TypeScript as a gRPC Server
 *
 * This example shows how to expose your TypeScript runtime to other Forthic
 * runtimes (Python, Ruby, etc.) via gRPC. Other runtimes can then call
 * TypeScript-specific modules like 'fs' remotely.
 *
 * Use case: You have Node.js file system operations that you want to use
 * from a Python data science workflow.
 */

import { startGrpcServer } from '@forthix/forthic/grpc';

async function main() {
  console.log('Starting TypeScript Forthic gRPC server...\n');

  // Start the server on port 50052
  const PORT = 50052;
  const server = await startGrpcServer(PORT);

  console.log(`✅ gRPC server running on port ${PORT}`);
  console.log('\nAvailable runtime-specific modules:');
  console.log('  - fs: File system operations (READ-FILE, WRITE-FILE, etc.)\n');
  console.log('Other runtimes can now connect and use these modules!\n');

  console.log('Example from Python:');
  console.log('```python');
  console.log('from forthic.grpc import GrpcClient, RemoteModule');
  console.log('');
  console.log("client = GrpcClient('localhost:50052')");
  console.log("fs_module = RemoteModule('fs', client, 'typescript')");
  console.log('await fs_module.initialize()');
  console.log('interp.register_module(fs_module)');
  console.log('');
  console.log('# Now you can use TypeScript fs module from Python!');
  console.log("await interp.run('\"package.json\" READ-FILE')");
  console.log('```\n');

  console.log('Press Ctrl+C to stop the server.');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gRPC server...');
    await new Promise<void>((resolve) => {
      server.tryShutdown(() => {
        console.log('Server stopped.');
        resolve();
      });
    });
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
