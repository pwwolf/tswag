import {
  OperationObject,
  ParameterObject,
  ResponseObject,
  SchemaObject,
  ReferenceObject,
  RequestBodyObject
} from "@loopback/openapi-v3-types";
import { NextFunction, Request, Response } from "express";
import { validateRequestBody } from "./lib/loopback/body.validator";
import { coerceParameter } from "./lib/loopback/coercion";

export function wireHandler(
  version: number,
  operation: any,
  req: Request,
  res: Response,
  next: NextFunction,
  handler: any
) {
  if (version !== 1) {
    throw new Error("Invalid version number: " + version);
  }
  let op = operation as OperationObject;
  let parameters: any = {};

  if (op.requestBody) {
    //TODO - catch error
    validateRequestBody(req.body, op.requestBody as RequestBodyObject);
  }

  for (let param of op.parameters || []) {
    let paramObject = param as ParameterObject;

    if (paramObject.in === "query") {
      if (paramObject.required) {
        if (req.query[paramObject.name]) {
        } else {
          throw new Error(
            "Missing required query parameter: " + paramObject.name
          );
        }
      }
      const coercedValue = coerceParameter(
        req.query[paramObject.name],
        paramObject
      );
      parameters[paramObject.name] = coercedValue;
    } else if (paramObject.in === "path") {
      if (paramObject.required) {
        if (req.params[paramObject.name]) {
        } else {
          throw new Error(
            "Missing required path parameter: " + paramObject.name
          );
        }
      }
      const coercedValue = coerceParameter(
        req.params[paramObject.name],
        paramObject
      );
      parameters[paramObject.name] = coercedValue;
    }
  }

  let context: any = {};
  context.parameters = parameters;
  context.body = req.body;
  for (let respCode of Object.keys(operation.responses)) {
    //upper case first letter in case it's 'default'
    let respCodeUpperCase =
      respCode.charAt(0).toUpperCase() + respCode.slice(1);

    let methodName = `send${respCodeUpperCase}`;
    //console.log("Wire up ", methodName);
    context[methodName] = (statusCode: number, responseObject: any) => {
      // console.log("Got response", responseObject);
      //TODO: validate response
      res.status(statusCode).json(responseObject);
    };

    let respObject = operation.responses[respCode] as ResponseObject;
  }

  //The handler function can be left undefined
  if (!handler) {
    return next(new Error(`Operation ${op.operationId} not yet implemented.`));
  }

  handler(context);
}
