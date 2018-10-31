"use strict";
exports.__esModule = true;
var util_1 = require("./util");
var validator = require("validator");
function isEmpty(data) {
    var result = data === "";
    return result;
}
exports.isEmpty = isEmpty;
/**
 * A set of truthy values. A data in this set will be coerced to `true`.
 *
 * @param data The raw data get from http request
 * @returns The corresponding coerced boolean type
 */
function isTrue(data) {
    return ["TRUE", "1"].includes(data.toUpperCase());
}
exports.isTrue = isTrue;
/**
 * A set of falsy values. A data in this set will be coerced to `false`.
 * @param data The raw data get from http request
 * @returns The corresponding coerced boolean type
 */
function isFalse(data) {
    return ["FALSE", "0"].includes(data.toUpperCase());
}
exports.isFalse = isFalse;
/**
 * Return false for invalid date
 */
function isValidDateTime(data) {
    return isNaN(data.getTime()) ? false : true;
}
exports.isValidDateTime = isValidDateTime;
var REGEX_RFC3339_DATE = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])$/;
/**
 * Return true when a date follows the RFC3339 standard
 *
 * @param date The date to verify
 */
function matchDateFormat(date) {
    var pattern = new RegExp(REGEX_RFC3339_DATE);
    var result = pattern.test(date);
    return result;
}
exports.matchDateFormat = matchDateFormat;
/**
 * Return the corresponding OpenAPI data type given an OpenAPI schema
 *
 * @param type The type in an OpenAPI schema specification
 * @param format The format in an OpenAPI schema specification
 */
function getOAIPrimitiveType(type, format) {
    if (type === "object" || type === "array")
        return type;
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
    if (type === "boolean")
        return "boolean";
    if (type === "number")
        switch (format) {
            case "float":
                return "float";
            case "double":
                return "double";
            default:
                return "number";
        }
    if (type === "integer")
        return format === "int64" ? "long" : "integer";
}
exports.getOAIPrimitiveType = getOAIPrimitiveType;
/**
 * Validator class provides a bunch of functions that perform
 * validations on the request parameters and request body.
 */
var Validator = /** @class */ (function () {
    function Validator(ctx) {
        this.ctx = ctx;
    }
    /**
     * The validation executed before type coercion. Like
     * checking absence.
     *
     * @param type A parameter's type.
     * @param value A parameter's raw value from http request.
     * @param opts options
     */
    Validator.prototype.validateParamBeforeCoercion = function (value, opts) {
        if (this.isAbsent(value) && this.isRequired(opts)) {
            var name_1 = this.ctx.parameterSpec.name;
            //throw RestHttpErrors.missingRequired(name);
            //TODO: Figure out validation errors
            throw new Error("Missing required parameter " + name_1);
        }
    };
    /**
     * Check is a parameter required or not.
     *
     * @param opts
     */
    Validator.prototype.isRequired = function (opts) {
        if (this.ctx.parameterSpec.required)
            return true;
        if (opts && opts.required)
            return true;
        return false;
    };
    /**
     * Return `true` if the value is empty, return `false` otherwise.
     *
     * @param value
     */
    // tslint:disable-next-line:no-any
    Validator.prototype.isAbsent = function (value) {
        if (value === "" || value === undefined)
            return true;
        var schema = this.ctx.parameterSpec.schema || {};
        if (schema.type === "object" && value === "null")
            return true;
        return false;
    };
    return Validator;
}());
exports.Validator = Validator;
/**
 * Coerce the http raw data to a JavaScript type data of a parameter
 * according to its OpenAPI schema specification.
 *
 * @param data The raw data get from http request
 * @param schema The parameter's schema defined in OpenAPI specification
 */
function coerceParameter(data, spec) {
    var schema = spec.schema;
    if (!schema || util_1.isReferenceObject(schema)) {
        return data;
    }
    var OAIType = getOAIPrimitiveType(schema.type, schema.format);
    var validator = new Validator({ parameterSpec: spec });
    validator.validateParamBeforeCoercion(data);
    if (data === undefined)
        return data;
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
exports.coerceParameter = coerceParameter;
function coerceString(data, spec) {
    if (typeof data !== "string") {
        //TODO: Figure out errors
        throw new Error("Cannot coerce non-string data");
        //throw RestHttpErrors.invalidData(data, spec.name);
    }
    return data;
}
function coerceBuffer(data, spec) {
    if (typeof data === "object") {
        throw new Error("Cannot coerce buffer data from object");
        //throw RestHttpErrors.invalidData(data, spec.name);
    }
    return Buffer.from(data, "base64");
}
function coerceDatetime(data, spec, options) {
    if (typeof data === "object" || isEmpty(data))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    if (options && options.dateOnly) {
        if (!matchDateFormat(data))
            throw new Error("Invalid data");
        //throw RestHttpErrors.invalidData(data, spec.name);
    }
    else {
        if (!validator.isRFC3339(data))
            throw new Error("Invalid data");
        //throw RestHttpErrors.invalidData(data, spec.name);
    }
    var coercedDate = new Date(data);
    if (!isValidDateTime(coercedDate))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    return coercedDate;
}
function coerceNumber(data, spec) {
    if (typeof data === "object" || isEmpty(data))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    var coercedNum = Number(data);
    if (isNaN(coercedNum))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    return coercedNum;
}
function coerceInteger(data, spec, options) {
    if (typeof data === "object" || isEmpty(data))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    var coercedInt = Number(data);
    if (isNaN(coercedInt))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    if (options && options.isLong) {
        if (!Number.isInteger(coercedInt))
            throw new Error("Invalid data");
        //throw RestHttpErrors.invalidData(data, spec.name);
    }
    else {
        if (!Number.isSafeInteger(coercedInt))
            throw new Error("Invalid data");
        //throw RestHttpErrors.invalidData(data, spec.name);
    }
    return coercedInt;
}
function coerceBoolean(data, spec) {
    if (typeof data === "object" || isEmpty(data))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
    if (isTrue(data))
        return true;
    if (isFalse(data))
        return false;
    throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(data, spec.name);
}
function coerceObject(input, spec) {
    var data = parseJsonIfNeeded(input, spec);
    if (data === undefined) {
        // Skip any further checks and coercions, nothing we can do with `undefined`
        return undefined;
    }
    if (typeof data !== "object" || Array.isArray(data))
        throw new Error("Invalid data");
    //throw RestHttpErrors.invalidData(input, spec.name);
    // TODO(bajtos) apply coercion based on properties defined by spec.schema
    return data;
}
function parseJsonIfNeeded(data, spec) {
    if (typeof data !== "string")
        return data;
    if (spec["in"] !== "query" || spec.style !== "deepObject") {
        return data;
    }
    if (data === "") {
        return undefined;
    }
    try {
        var result = JSON.parse(data);
        return result;
    }
    catch (err) {
        /*throw RestHttpErrors.invalidData(data, spec.name, {
          details: {
            syntaxError: err.message
          }
        });*/
        throw new Error("Invalid data");
    }
}
