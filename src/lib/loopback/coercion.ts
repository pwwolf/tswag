// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import { RestHttpErrors } from "./http-errors";
import { ParameterObject, isReferenceObject, SchemaObject } from "openapi3-ts";
const isRFC3339 = require("validator/lib/isRFC3339");

/**
 * Coerce the http raw data to a JavaScript type data of a parameter
 * according to its OpenAPI schema specification.
 *
 * @param data - The raw data get from http request
 * @param schema - The parameter's schema defined in OpenAPI specification
 */
export function coerceParameter(
  data: string | undefined | object,
  spec: ParameterObject
) {
  const schema = spec.schema;
  if (!schema || isReferenceObject(schema)) {
    return data;
  }
  const OAIType = getOAIPrimitiveType(schema.type, schema.format);
  const validator = new Validator({ parameterSpec: spec });

  validator.validateParamBeforeCoercion(data);
  if (data === undefined) return data;

  switch (OAIType) {
    case "byte":
      return coerceBuffer(data, spec);
    case "date":
      return coerceDatetime(data, spec, { dateOnly: true });
    case "date-time":
      return coerceDatetime(data, spec);
    case "float":
    case "double":
    case "number":
      return coerceNumber(data, spec);
    case "long":
      return coerceInteger(data, spec, { isLong: true });
    case "integer":
      return coerceInteger(data, spec);
    case "boolean":
      return coerceBoolean(data, spec);
    case "object":
      return coerceObject(data, spec);
    case "string":
    case "password":
      return coerceString(data, spec);
    default:
      return data;
  }
}

function coerceString(data: string | object, spec: ParameterObject) {
  if (typeof data !== "string")
    throw RestHttpErrors.invalidData(data, spec.name);

  return data;
}

function coerceBuffer(data: string | object, spec: ParameterObject) {
  if (typeof data === "object")
    throw RestHttpErrors.invalidData(data, spec.name);
  return Buffer.from(data, "base64");
}

function coerceDatetime(
  data: string | object,
  spec: ParameterObject,
  options?: DateCoercionOptions
) {
  if (typeof data === "object" || isEmpty(data))
    throw RestHttpErrors.invalidData(data, spec.name);

  if (options && options.dateOnly) {
    if (!matchDateFormat(data))
      throw RestHttpErrors.invalidData(data, spec.name);
  } else {
    if (!isRFC3339(data)) throw RestHttpErrors.invalidData(data, spec.name);
  }

  const coercedDate = new Date(data);
  if (!isValidDateTime(coercedDate))
    throw RestHttpErrors.invalidData(data, spec.name);
  return coercedDate;
}

function coerceNumber(data: string | object, spec: ParameterObject) {
  if (typeof data === "object" || isEmpty(data))
    throw RestHttpErrors.invalidData(data, spec.name);

  const coercedNum = Number(data);
  if (isNaN(coercedNum)) throw RestHttpErrors.invalidData(data, spec.name);

  return coercedNum;
}

function coerceInteger(
  data: string | object,
  spec: ParameterObject,
  options?: IntegerCoercionOptions
) {
  if (typeof data === "object" || isEmpty(data))
    throw RestHttpErrors.invalidData(data, spec.name);

  const coercedInt = Number(data);
  if (isNaN(coercedInt!)) throw RestHttpErrors.invalidData(data, spec.name);

  if (options && options.isLong) {
    if (!Number.isInteger(coercedInt))
      throw RestHttpErrors.invalidData(data, spec.name);
  } else {
    if (!Number.isSafeInteger(coercedInt))
      throw RestHttpErrors.invalidData(data, spec.name);
  }

  return coercedInt;
}

function coerceBoolean(data: string | object, spec: ParameterObject) {
  if (typeof data === "object" || isEmpty(data))
    throw RestHttpErrors.invalidData(data, spec.name);
  if (isTrue(data)) return true;
  if (isFalse(data)) return false;
  throw RestHttpErrors.invalidData(data, spec.name);
}

function coerceObject(input: string | object, spec: ParameterObject) {
  const data = parseJsonIfNeeded(input, spec);

  if (data === undefined) {
    // Skip any further checks and coercions, nothing we can do with `undefined`
    return undefined;
  }

  if (typeof data !== "object" || Array.isArray(data))
    throw RestHttpErrors.invalidData(input, spec.name);

  // TODO(bajtos) apply coercion based on properties defined by spec.schema
  return data;
}

function parseJsonIfNeeded(
  data: string | object,
  spec: ParameterObject
): string | object | undefined {
  if (typeof data !== "string") return data;

  if (spec.in !== "query" || spec.style !== "deepObject") {
    return data;
  }

  if (data === "") {
    return undefined;
  }

  try {
    const result = parseJson(data);
    return result;
  } catch (err) {
    throw RestHttpErrors.invalidData(data, spec.name, {
      details: {
        syntaxError: err.message
      }
    });
  }
}

/**
 * Options for function coerceDatetime
 */
export type DateCoercionOptions = {
  dateOnly?: boolean;
};

/**
 * Options for function coerceInteger
 */
export type IntegerCoercionOptions = {
  isLong?: boolean;
};

export function isEmpty(data: string) {
  const result = data === "";
  return result;
}
/**
 * A set of truthy values. A data in this set will be coerced to `true`.
 *
 * @param data - The raw data get from http request
 * @returns The corresponding coerced boolean type
 */
export function isTrue(data: string): boolean {
  return ["TRUE", "1"].includes(data.toUpperCase());
}

/**
 * A set of falsy values. A data in this set will be coerced to `false`.
 * @param data - The raw data get from http request
 * @returns The corresponding coerced boolean type
 */
export function isFalse(data: string): boolean {
  return ["FALSE", "0"].includes(data.toUpperCase());
}

/**
 * Return false for invalid date
 */
export function isValidDateTime(data: Date) {
  return isNaN(data.getTime()) ? false : true;
}

const REGEX_RFC3339_DATE = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])$/;

/**
 * Return true when a date follows the RFC3339 standard
 *
 * @param date - The date to verify
 */
export function matchDateFormat(date: string) {
  const pattern = new RegExp(REGEX_RFC3339_DATE);
  const result = pattern.test(date);
  return result;
}

/**
 * Return the corresponding OpenAPI data type given an OpenAPI schema
 *
 * @param type - The type in an OpenAPI schema specification
 * @param format - The format in an OpenAPI schema specification
 */
export function getOAIPrimitiveType(type?: string, format?: string) {
  if (type === "object" || type === "array") return type;
  if (type === "string") {
    switch (format) {
      case "byte":
        return "byte";
      case "binary":
        return "binary";
      case "date":
        return "date";
      case "date-time":
        return "date-time";
      case "password":
        return "password";
      default:
        return "string";
    }
  }
  if (type === "boolean") return "boolean";
  if (type === "number")
    switch (format) {
      case "float":
        return "float";
      case "double":
        return "double";
      default:
        return "number";
    }
  if (type === "integer") return format === "int64" ? "long" : "integer";
}

// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/* eslint-disable @typescript-eslint/no-explicit-any */

// These utilities are introduced to mitigate the prototype pollution issue
// with `JSON.parse`.
// See https://hueniverse.com/a-tale-of-prototype-poisoning-2610fa170061
//
// The [bourne](https://github.com/hapijs/bourne) module provides a drop-in
// replacement for `JSON.parse` but we need to instruct `body-parser` to honor
// a `reviver` function.

/**
 * Factory to create a reviver function for `JSON.parse` to sanitize keys
 * @param reviver - Reviver function
 */
export function sanitizeJsonParse(reviver?: (key: any, value: any) => any) {
  return (key: string, value: any) => {
    if (key === "__proto__")
      throw new Error('JSON string cannot contain "__proto__" key.');
    if (reviver) {
      return reviver(key, value);
    } else {
      return value;
    }
  };
}

/**
 *
 * @param text - JSON string
 * @param reviver - Optional reviver function for `JSON.parse`
 */
export function parseJson(
  text: string,
  reviver?: (key: any, value: any) => any
) {
  return JSON.parse(text, sanitizeJsonParse(reviver));
}

// Copyright IBM Corp. 2018,2019. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/**
 * A set of options to pass into the validator functions
 */
export type ValidationOptions = {
  required?: boolean;
};

/**
 * The context information that a validator needs
 */
export type ValidationContext = {
  parameterSpec: ParameterObject;
};

/**
 * Validator class provides a bunch of functions that perform
 * validations on the request parameters and request body.
 */
export class Validator {
  constructor(public ctx: ValidationContext) {}

  /**
   * The validation executed before type coercion. Like
   * checking absence.
   *
   * @param type - A parameter's type.
   * @param value - A parameter's raw value from http request.
   * @param opts - options
   */
  validateParamBeforeCoercion(
    value: string | object | undefined,
    opts?: ValidationOptions
  ) {
    if (this.isAbsent(value) && this.isRequired(opts)) {
      const name = this.ctx.parameterSpec.name;
      throw RestHttpErrors.missingRequired(name);
    }
  }

  /**
   * Check is a parameter required or not.
   *
   * @param opts
   */
  isRequired(opts?: ValidationOptions) {
    if (this.ctx.parameterSpec.required) return true;
    if (opts && opts.required) return true;
    return false;
  }

  /**
   * Return `true` if the value is empty, return `false` otherwise.
   *
   * @param value
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isAbsent(value: any) {
    if (value === "" || value === undefined) return true;

    const schema: SchemaObject = this.ctx.parameterSpec.schema || {};
    if (schema.type === "object" && value === "null") return true;

    return false;
  }
}
