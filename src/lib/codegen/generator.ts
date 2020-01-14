import * as ts from "typescript";
import { generateTypeNode } from "./models";
import { createRegisterHandlersFunction } from "./handlers";
import { OpenAPIObject } from "openapi3-ts";

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

function printNode(node: ts.Node) {
  const result = printer.printNode(ts.EmitHint.Unspecified, node, resultFile);
  console.log(result);
}

export function generateApi(spec: OpenAPIObject, deref: OpenAPIObject) {
  //create imports
  let tswagImport = ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(
      undefined,
      ts.createNamedImports([
        ts.createImportSpecifier(undefined, ts.createIdentifier("wireHandler"))
      ])
    ),
    //ts.createImportSpecifier(ts.createIdentifier("wireHandler"))
    ts.createStringLiteral("tswag")
  );

  let expressImport = ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(
      undefined,
      ts.createNamespaceImport(ts.createIdentifier("express"))
    ),
    //ts.createImportSpecifier(ts.createIdentifier("wireHandler"))
    ts.createStringLiteral("express")
  );

  let modelsDeclarations = [];
  //generate namespace
  if (spec.components && spec.components.schemas) {
    for (let typeName of Object.keys(spec.components.schemas)) {
      let schema = spec.components.schemas[typeName];
      let type = generateTypeNode(schema);

      //Creates type Pet =  {....}
      let declaration = ts.createTypeAliasDeclaration(
        undefined,
        [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
        typeName,
        undefined,
        type
      );
      modelsDeclarations.push(declaration);
    }
  }

  const regHandlersFunc = createRegisterHandlersFunction(spec, deref);

  const namespace = spec.info.title.replace(/ /g, "");

  let module = ts.createModuleDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(namespace),
    ts.createModuleBlock([...modelsDeclarations, regHandlersFunc]),
    undefined
  );
  printNode(tswagImport);
  printNode(expressImport);
  printNode(module);
}
