// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { ReferenceObject, SchemaObject } from "@loopback/openapi-v3";
import * as ajv from "ajv";
import {
  Options,
  OptionsJson,
  OptionsText,
  OptionsUrlencoded
} from "body-parser";
import { Request, Response } from "express";

export { Request, Response };

/**
 * An object holding HTTP request, response and other data
 * needed to handle an incoming HTTP request.
 */
export interface HandlerContext {
  readonly request: Request;
  readonly response: Response;
}

/**
 * Reject the request with an error.
 *
 * @param handlerContext - The context object holding HTTP request, response
 * and other data  needed to handle an incoming HTTP request.
 * @param err - The error.
 */
export type Reject = (handlerContext: HandlerContext, err: Error) => void;

/**
 * Log information about a failed request.
 *
 * @param err - The error reported by request handling code.
 * @param statusCode - Status code of the HTTP response
 * @param request - The request that failed.
 */
export type LogError = (
  err: Error,
  statusCode: number,
  request: Request
) => void;

/**
 * Options for request body validation using AJV
 */
export interface RequestBodyValidationOptions extends ajv.Options {
  /**
   * Custom cache for compiled schemas by AJV. This setting makes it possible
   * to skip the default cache.
   */
  compiledSchemaCache?: WeakMap<
    SchemaObject | ReferenceObject,
    ajv.ValidateFunction
  >;
}
