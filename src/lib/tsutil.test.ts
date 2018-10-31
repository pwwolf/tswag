import { convertJsonToLiteral } from "./tsutil";
import * as ts from "typescript";

test("expect undefined to be undefined", () => {
  let node = convertJsonToLiteral(undefined);
  let js = tsToJson(node);
  expect(js).toBeUndefined();
});

test("expect null to be null", () => {
  let node = convertJsonToLiteral(null);
  let js = tsToJson(node);
  expect(js).toBeNull();
});

test("expect a number to be a number", () => {
  let node = convertJsonToLiteral(42);
  let js = tsToJson(node);
  expect(js).toBe(42);
});

test("expect 0 to be 0", () => {
  let node = convertJsonToLiteral(0);
  let js = tsToJson(node);
  expect(js).toBe(0);
});

test("expect true to be true", () => {
  let node = convertJsonToLiteral(true);
  let js = tsToJson(node);
  expect(js).toBe(true);
});

test("expect false to be false", () => {
  let node = convertJsonToLiteral(false);
  let js = tsToJson(node);
  expect(js).toBe(false);
});

test("expect a string to be a string", () => {
  let node = convertJsonToLiteral("foo");
  let js = tsToJson(node);
  expect(js).toBe("foo");
});

test("expect an empty array to be an empty array", () => {
  let node = convertJsonToLiteral([]);
  let js = tsToJson(node);
  expect(js).toStrictEqual([]);
});

test("expect an array to be an array", () => {
  let node = convertJsonToLiteral(["a", 1, true]);
  let js = tsToJson(node);
  expect(js).toStrictEqual(["a", 1, true]);
});

test("expect an empty object to be an object", () => {
  let node = convertJsonToLiteral({});
  let js = tsToJson(node);
  expect(js).toStrictEqual({});
});

test("expect an object to be an object", () => {
  let obj = {
    foo: "bar",
    "test-foo": "test-bar",
    a: ["b"],
    true: false,
    nested: {
      foo: "bar",
      nested: {
        foo: "bar"
      }
    },
    1: 2,
    b: ["c", "d", 1, 3, 4]
  };
  let node = convertJsonToLiteral(obj);
  let js = tsToJson(node);
  expect(js).toStrictEqual(obj);
});

//Convert a typescript node to source and then back to JSON
function tsToJson(node: ts.Node) {
  let tsSource = printNode(node).trim();
  if (tsSource === "undefined") {
    return undefined;
  }
  return JSON.parse(tsSource);
}
const resultFile = ts.createSourceFile(
  "api.ts",
  "",
  ts.ScriptTarget.Latest,
  /*setParentNodes*/ false,
  ts.ScriptKind.TS
);
const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed
});

//Converts a typescript node to the source string
function printNode(node: ts.Node) {
  const result = printer.printNode(ts.EmitHint.Unspecified, node, resultFile);
  return result;
}
