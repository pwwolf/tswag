import * as ts from "typescript";
import { generateTypeNode } from "./models";
import {
  createRegisterHandlersFunction,
  createHandlerContextModels
} from "./handlers";
import { OpenAPIObject } from "openapi3-ts";

type WritableStream = {
  write: (chunk: any) => any;
};
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

function printNode(node: ts.Node, out: WritableStream) {
  const result = printer.printNode(ts.EmitHint.Unspecified, node, resultFile);
  out.write(result);
}

export function generateApi(
  spec: OpenAPIObject,
  deref: OpenAPIObject,
  out: WritableStream
) {
  //create imports
  let tstubImport = ts.createImportDeclaration(
    undefined,
    undefined,
    ts.createImportClause(
      undefined,
      ts.createNamedImports([
        ts.createImportSpecifier(undefined, ts.createIdentifier("wireHandler"))
      ])
    ),
    //ts.createImportSpecifier(ts.createIdentifier("wireHandler"))
    ts.createStringLiteral("tstub")
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
  const contextTypes = createHandlerContextModels(spec);
  for (let entry of contextTypes) {
    let declaration = ts.createTypeAliasDeclaration(
      undefined,
      [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
      entry.name,
      undefined,
      entry.type
    );
    modelsDeclarations.push(declaration);
  }

  const namespace = spec.info.title.replace(/ /g, "");

  let module = ts.createModuleDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier(namespace),
    ts.createModuleBlock([...modelsDeclarations, regHandlersFunc]),
    undefined
  );
  printNode(tstubImport, out);
  printNode(expressImport, out);
  printNode(module, out);
}
