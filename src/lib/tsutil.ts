import * as ts from "typescript";

/**
 * Takes a normal JSON object, .e.g
 * {
 *   foo: 'bar'
 * }
 *
 * And converts it into a typescript expression
 * @param json
 */
export default function convertJsonToLiteral(json?: any): ts.Expression {
  if (typeof json === "undefined") {
    return ts.createIdentifier("undefined");
  }

  if (typeof json === "string") {
    return ts.createStringLiteral(json);
  }

  if (json === true) {
    return ts.createTrue();
  }

  if (json === false) {
    return ts.createFalse();
  }

  if (typeof json === "string") {
    return ts.createStringLiteral(json);
  }

  if (typeof json === "number") {
    return ts.createNumericLiteral(String(json));
  }

  if (json === null) {
    return ts.createIdentifier("null");
  }

  if (json.constructor === Array) {
    let items: any[] = json;
    let itemExpressions: ReadonlyArray<ts.Expression> = items.map(item =>
      convertJsonToLiteral(item)
    );
    return ts.createArrayLiteral(itemExpressions);
  }

  if (typeof json === "object") {
    let objects: ReadonlyArray<ts.ObjectLiteralElementLike> = Object.keys(
      json
    ).map(key => {
      return ts.createPropertyAssignment(
        ts.createStringLiteral(key),
        convertJsonToLiteral(json[key])
      );
    });
    return ts.createObjectLiteral(objects, true);
  }

  throw new Error("Unknown type: " + JSON.stringify(json));
}
