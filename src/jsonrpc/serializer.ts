/**
 * JSON-RPC serializer — re-exports the gRPC serializer.
 *
 * The StackValue tagged-union shape (`{ int_value }`, `{ string_value }`,
 * `{ array_value: { items: [...] } }`, etc.) is JSON-clean, so the same
 * (serializeValue, deserializeValue) functions work for both transports.
 */
export { serializeValue, deserializeValue } from '../grpc/serializer.js';
