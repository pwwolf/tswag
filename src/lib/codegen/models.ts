import * as ts from "typescript";
import { ReferenceObject, SchemaObject, isReferenceObject } from "openapi3-ts";

/**
 * Create a type reference node for the given ref.
 * Assumes ref is a top-level element within component schemas
 * @param referenceObject
 */
function generateTypeRefFromReferenceObject(
  referenceObject: ReferenceObject
): ts.TypeReferenceNode {
  let refString = referenceObject.$ref;
  let refType = refString.substring(refString.lastIndexOf("/") + 1);
  return ts.createTypeReferenceNode(refType, undefined);
}

function generateTypeRefFromAllOf(
  schemas: (SchemaObject | ReferenceObject)[]
): ts.IntersectionTypeNode {
  return ts.createIntersectionTypeNode(
    schemas.map(schema => {
      if (isReferenceObject(schema)) {
        return generateTypeRefFromReferenceObject(schema);
      }

      //Is schema object
      return generateTypeNode(schema);
    })
  );
}

function generateTypeRefFromOneOf(
  schemas: (SchemaObject | ReferenceObject)[]
): ts.UnionTypeNode {
  return ts.createUnionTypeNode(
    schemas.map(schema => {
      if (isReferenceObject(schema)) {
        return generateTypeRefFromReferenceObject(schema as ReferenceObject);
      }
      return generateTypeNode(schema);
    })
  );
}

export function generateTypeNode(
  schemaObject: SchemaObject | ReferenceObject
): ts.TypeNode {
  if (isReferenceObject(schemaObject)) {
    return generateTypeRefFromReferenceObject(schemaObject);
  }

  if (schemaObject.allOf) {
    return generateTypeRefFromAllOf(schemaObject.allOf);
  } else if (schemaObject.oneOf) {
    return generateTypeRefFromOneOf(schemaObject.oneOf);
  } else if (schemaObject.anyOf) {
    throw new Error("Any of not supported");
  }

  if (schemaObject.properties || schemaObject.type === "object") {
    let type = ts.createTypeLiteralNode(
      Object.entries(schemaObject.properties || {}).map(([key, value]) => {
        let propType: SchemaObject | ReferenceObject = value;
        let typeRef: ts.TypeNode;
        let required = false;
        typeRef = generateTypeNode(propType);
        if (schemaObject.required && schemaObject.required.includes(key)) {
          required = true;
        }

        return ts.createPropertySignature(
          undefined,
          ts.createStringLiteral(key),
          required ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken),
          typeRef,
          undefined
        );
      })
    );
    return type;
  } else if (schemaObject.type === "array" && schemaObject.items) {
    return ts.createArrayTypeNode(generateTypeNode(schemaObject.items));
  } else if (schemaObject.type === "string") {
    return ts.createTypeReferenceNode("string", undefined);
  } else if (
    schemaObject.type === "integer" ||
    schemaObject.type === "number"
  ) {
    return ts.createTypeReferenceNode("number", undefined);
  } else if (schemaObject.type === "boolean") {
    return ts.createTypeReferenceNode("boolean", undefined);
  } else if (schemaObject.enum) {
    return ts.createUnionTypeNode(
      schemaObject.enum.map(e => {
        return ts.createLiteralTypeNode(ts.createStringLiteral(e));
      })
    );
  } else {
    throw new Error("Unknown property type: " + JSON.stringify(schemaObject));
  }
}
