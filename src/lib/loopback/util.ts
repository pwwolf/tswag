import { SchemaObject, ReferenceObject } from "openapi3-ts";

export function isSchemaObject(
  schema: SchemaObject | ReferenceObject
): schema is SchemaObject {
  return !schema.hasOwnProperty("$ref");
}

export function isReferenceObject(obj: object): obj is ReferenceObject {
  return obj.hasOwnProperty("$ref");
}
