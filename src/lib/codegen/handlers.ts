import * as ts from "typescript";
import { convertJsonToLiteral } from "../tsutil";
import { convertPathToExpress } from "../expressutil";
import { generateTypeNode } from "./models";
import {
  ParameterObject,
  isReferenceObject,
  OperationObject,
  ResponseObject,
  PathItemObject,
  OpenAPIObject
} from "openapi3-ts";

//Version is checked at express runtime by wireHandlers
const API_VERSION = 1;

/**
 * Creates a call that looks like
 *
 * router.get('/foo/bar, (req: any, res: any, next: any) => {
 *   operation = {..operation schema..}
 *   wireHandler(...)
 * });
 * @param path
 * @param method
 * @param pathItemElement
 */
function createRequestMethodBody(
  path: string,
  method: string,
  pathItemElement: OperationObject
) {
  //We will define a const named 'operation' containing the swagger definition
  const swagVariableName = "operation";

  //Create the arrow function for the expressjs callback
  //for simplicity, we give req, res, next all 'any' type
  let handlerFunc = ts.createArrowFunction(
    undefined,
    [],
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        "req",
        undefined,
        undefined,
        undefined
      ),
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        "res",
        undefined,
        undefined,
        undefined
      ),
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        "next",
        undefined,
        undefined,
        undefined
      )
    ],
    undefined,
    undefined,

    ts.createBlock(
      [
        //Creates const operation = ...
        ts.createVariableStatement(
          undefined,
          ts.createVariableDeclarationList(
            [
              ts.createVariableDeclaration(
                swagVariableName,
                undefined,
                convertJsonToLiteral(pathItemElement)
              )
            ],
            ts.NodeFlags.Const
          )
        ),

        //Create a call to wireHandler(version, req, res, next, handler[operationId])
        ts.createExpressionStatement(
          ts.createCall(ts.createIdentifier("wireHandler"), undefined, [
            ts.createNumericLiteral(String(API_VERSION)),
            ts.createIdentifier(swagVariableName),
            ts.createIdentifier("req"),
            ts.createIdentifier("res"),
            ts.createIdentifier("next"),
            ts.createElementAccess(
              ts.createIdentifier("handlers"),
              ts.createStringLiteral(pathItemElement.operationId!)
            )
            /*ts.createPropertyAccess(
              ts.createIdentifier("handlers"),
              ts.createIdentifier(pathItemElement.operationId!)
            )
            */
          ])
        )
      ],
      true
    )
  );

  //Make the call to router.get|post|etc(/foo/bar, ...)
  let expressRegCall = ts.createCall(
    ts.createPropertyAccess(
      ts.createIdentifier("router"),
      ts.createIdentifier(method)
    ),
    undefined,
    [ts.createStringLiteral(convertPathToExpress(path)), handlerFunc]
  );

  return ts.createExpressionStatement(expressRegCall);
}

// In the example below, this generates the type for ctx param
// findPets: (ctx: {parameters: {...}, send200: (response: Pet[]) => void, sendDefault: (response: Error) => void}
function createPropertySignatureTypeForRestMethod(operation: OperationObject) {
  let params: ts.PropertySignature[] = (operation.parameters || []).map(
    param => {
      //TODO: Could be a reference
      if (isReferenceObject(param)) {
        throw new Error("Can't handle param refs");
      } else {
        let paramObj = param as ParameterObject;
        let type: ts.TypeNode | undefined = undefined;
        if (paramObj.schema) {
          type = generateTypeNode(paramObj.schema);
        }
        return ts.createPropertySignature(
          undefined,
          paramObj.name,
          undefined,
          type,
          undefined
        );
      }
    }
  );

  let paramProp = ts.createPropertySignature(
    undefined,
    "parameters",
    undefined,
    ts.createTypeLiteralNode(params),
    undefined
  );

  let respProps = [];
  for (let respCode of Object.keys(operation.responses)) {
    //upper case first letter in case it's 'default'
    let respCodeUpperCase =
      respCode.charAt(0).toUpperCase() + respCode.slice(1);
    let methodName = `send${respCodeUpperCase}`;
    let respObject = operation.responses[respCode] as ResponseObject;
    let paramName = "response";

    let respTypeRef: ts.TypeNode | undefined;
    if (respObject.content && respObject.content["application/json"]) {
      let responseSchema = respObject.content!["application/json"].schema!;
      respTypeRef = generateTypeNode(responseSchema);
    } else {
      respTypeRef = ts.createTypeReferenceNode("any", undefined);
    }

    let respPropType = ts.createFunctionTypeNode(
      undefined,
      [
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          "statusCode",
          undefined,
          ts.createTypeReferenceNode("number", undefined),
          undefined
        ),
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          paramName,
          undefined,
          respTypeRef,
          undefined
        )
      ],
      ts.createTypeReferenceNode("void", undefined)
    );
    respProps.push(
      ts.createPropertySignature(
        undefined,
        methodName,
        undefined,
        respPropType,
        undefined
      )
    );
  }

  let reqBody: ts.PropertySignature[] = [];
  if (operation.requestBody) {
    if (isReferenceObject(operation.requestBody)) {
      throw new Error("ref object not yet supported for request body");
    }

    let reqBodyTypeRef: ts.TypeNode | undefined;

    let requestBodySpec = operation.requestBody;
    if (
      requestBodySpec.content &&
      requestBodySpec.content["application/json"]
    ) {
      let bodySchema = requestBodySpec.content!["application/json"].schema!;
      reqBodyTypeRef = generateTypeNode(bodySchema);
    } else {
      reqBodyTypeRef = ts.createTypeReferenceNode("any", undefined);
    }

    reqBody.push(
      ts.createPropertySignature(
        undefined,
        "body",
        operation.requestBody.required
          ? undefined
          : ts.createToken(ts.SyntaxKind.QuestionToken),
        reqBodyTypeRef,
        undefined
      )
    );
  }
  let ctxType = ts.createTypeLiteralNode([paramProp, ...reqBody, ...respProps]);
  return ctxType;
}

/**
 * For a given operation, which represents a particular HTTP URL and method,
 * create the signature. For example, an operation GET /pets with an operationId
 * of findPets, this will create
 *
 * findPets: (ctx: FindPetsParam)
 * //Where FindPetsParam = {parameters: {...}, send200: (response: Pet[]) => void, sendDefault: (response: Error) => void}
 * @param operation
 */
function createPropertySignatureForRestMethod(operation: OperationObject) {
  let opId = operation.operationId;
  if (!opId) {
    throw new Error("Missing operation ID");
  }

  //let ctxType = createPropertySignatureTypeForRestMethod(operation)
  let ctxType = ts.createTypeReferenceNode(
    convertOperationIdToTypeName(opId),
    undefined
  );

  let type = ts.createFunctionTypeNode(
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        "ctx",
        undefined,
        ctxType
      )
    ],
    ts.createTypeReferenceNode("void", undefined)
  );

  let node = ts.createPropertySignature(
    undefined,
    ts.createStringLiteral(opId),
    ts.createToken(ts.SyntaxKind.QuestionToken), //a given handler is set to optional to make dev easier
    type,
    undefined
  );
  return node;
}

//convert an operation ID into a suitable type name
function convertOperationIdToTypeName(operationId: string) {
  let str = operationId;
  //capitalize first letter
  str = str.replace(/^\w/, c => c.toUpperCase());

  //If there are spaces, remove them but capitalize each segment
  str = str
    .split(" ")
    .map(s => s.replace(/^\w/, c => c.toUpperCase()))
    .join("");
  return `${str}Param`;
}

export function createHandlerContextModels(spec: OpenAPIObject) {
  let typeList: { name: string; type: ts.TypeLiteralNode }[] = [];
  for (let path of Object.keys(spec.paths)) {
    let pathItem = spec.paths[path] as PathItemObject;
    for (let method of ["get", "put", "delete", "post", "patch"]) {
      if (pathItem[method] && pathItem[method].operationId) {
        let typeName = convertOperationIdToTypeName(
          pathItem[method].operationId
        );
        let type = createPropertySignatureTypeForRestMethod(pathItem[method]);
        typeList.push({ name: typeName, type });
      }
    }
  }
  return typeList;
}

//Creates an export const operationIds = ['a', 'b', 'c']
export function createOperationIdArray(spec: OpenAPIObject) {
  let opList: string[] = [];
  for (let path of Object.keys(spec.paths)) {
    let pathItem = spec.paths[path] as PathItemObject;
    for (let method of ["get", "put", "delete", "post", "patch"]) {
      if (pathItem[method] && pathItem[method].operationId) {
        opList.push(pathItem[method].operationId);
      }
    }
  }

  return ts.createVariableStatement(
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createVariableDeclarationList(
      [
        ts.createVariableDeclaration(
          ts.createIdentifier("operationIds"),
          undefined,
          ts.createArrayLiteral(
            opList.map(op => ts.createStringLiteral(op)),
            false
          )
        )
      ],
      ts.NodeFlags.Const
    )
  );
}

export function createRegisterHandlersFunction(
  spec: OpenAPIObject,
  dereferencedSpec: OpenAPIObject
) {
  let restMethodSignatures = [];
  let restMethodBody = [];
  for (let path of Object.keys(spec.paths)) {
    let pathItem = spec.paths[path] as PathItemObject;
    for (let method of ["get", "put", "delete", "post", "patch"]) {
      if (pathItem[method]) {
        let propSig = createPropertySignatureForRestMethod(pathItem[method]);

        //typescript doesn't properly support jsdoc comments yet
        //https://github.com/microsoft/TypeScript/issues/17146
        ts.addSyntheticLeadingComment(
          propSig,
          ts.SyntaxKind.MultiLineCommentTrivia,
          `*\n * ${method.toUpperCase()} ${path}\n${pathItem[method]
            .description || ""}\n `,
          true
        );
        restMethodSignatures.push(propSig);
        restMethodBody.push(
          //Use the dereferenced version for this because we don't want any references in the embedded operation schema
          createRequestMethodBody(
            path,
            method,
            dereferencedSpec.paths[path][method]
          )
        );
      }
    }
  }

  let regFunc = ts.createFunctionDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    "registerHandlers",
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        "router",
        undefined,
        ts.createTypeReferenceNode(
          ts.createQualifiedName(ts.createIdentifier("express"), "IRouter"),
          []
        )
      ),
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        "handlers",
        undefined,
        ts.createTypeLiteralNode(restMethodSignatures)
      )
    ],
    undefined,
    ts.createBlock(restMethodBody)
  );

  return regFunc;
}
