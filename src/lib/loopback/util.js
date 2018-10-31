"use strict";
exports.__esModule = true;
function isSchemaObject(schema) {
    return !schema.hasOwnProperty("$ref");
}
exports.isSchemaObject = isSchemaObject;
function isReferenceObject(obj) {
    return obj.hasOwnProperty("$ref");
}
exports.isReferenceObject = isReferenceObject;
