# Forthic gRPC Protocol Definitions

This directory contains versioned Protocol Buffer definitions for Forthic's multi-runtime communication.

## Versioning

Protocol definitions are organized by version to ensure compatibility:

- **v1/** - Initial gRPC protocol version
  - Basic types: int, string, bool, float, null, array, record
  - Temporal types: instant, plain_date, zoned_datetime
  - Operations: ExecuteWord, ExecuteSequence, ListModules, GetModuleInfo
  - Error handling with rich context

## Version History

### v1 (Current)
- Initial release supporting TypeScript ↔ Python ↔ Ruby ↔ Rust cross-runtime execution
- Full type serialization for all Forthic standard types
- Module discovery and introspection
- Enhanced error reporting with stack traces and context

## Usage

The proto files are automatically loaded by the gRPC client and server:

```typescript
import { GrpcClient } from '@forthix/forthic/grpc/client';
import { serve } from '@forthix/forthic/grpc/server';

// Client connects to remote runtime
const client = new GrpcClient('localhost:50051');
const result = await client.executeWord('WORD-NAME', [1, 2, 3]);

// Server exposes TypeScript runtime
await serve(50052);
```

## Future Versions

When protocol changes are needed:
1. Copy current version to new directory (e.g., `v2/`)
2. Make changes in new version
3. Update client/server to support multiple versions if needed
4. Deprecate old versions with migration timeline
