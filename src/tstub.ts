import { NextFunction, Request, Response } from "express";
import { validateValueAgainstSchema } from "./lib/loopback/body.validator";
import { coerceParameter } from "./lib/loopback/coercion";
import {
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  OperationObject,
  SchemaObject
} from "openapi3-ts";
import { RequestBodyValidationOptions } from "./lib/loopback/types";

const validationOptions: RequestBodyValidationOptions = {
  //Currently ajv doesn't support int64 or int32, so ignore for now
  unknownFormats: ["int64", "int32"]
};

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
    let reqBody = op.requestBody as RequestBodyObject;
    try {
      if (reqBody.required === true) {
        validateValueAgainstSchema(
          req.body,
          reqBody.content["application/json"].schema as SchemaObject,
          {},
          validationOptions
        );
      }
    } catch (err) {
      return res
        .status(422)
        .json({ message: "validation error", details: err.details });
    }
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
      res.status(statusCode).json(responseObject);
      let respObject = operation.responses[respCode] as ResponseObject;
      //TODO: Make this configurable and decide how to surface error
      try {
        if (
          respObject.content &&
          respObject.content["application/json"] &&
          respObject.content["application/json"].schema
        ) {
          validateValueAgainstSchema(
            responseObject,
            respObject.content["application/json"].schema,
            {},
            validationOptions
          );
        }
      } catch (err) {
        console.warn(err);
      }
    };
  }

  //The handler function can be left undefined
  if (!handler) {
    return next(new Error(`Operation ${op.operationId} not yet implemented.`));
  }

  handler(context);
}
