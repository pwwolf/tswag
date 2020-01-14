#!/usr/bin/env node

import { bundle, dereference } from "swagger-parser";
import { generateApi } from "./lib/codegen/generator";
import * as minimist from "minimist";
import { stat } from "fs";
import { OpenAPIObject } from "openapi3-ts";
const converter = require("swagger2openapi");

const argv = minimist(process.argv.slice(2));

if (argv._.length < 1) {
  console.warn("Must provide path to OpenAPI spec as an argument");
  process.exit(0);
}

stat(argv._[0], async (err, stats) => {
  if (err) {
    console.warn(`${argv._[0]} does not exist.`);
    process.exit(0);
  }

  let result = await bundle(argv._[0]);
  if ((result as any)["swagger"]) {
    console.warn("Converting Swagger 2.0 doc to OpenAPI 3.0");
    let doc = await convertSwaggerToOpenApi(result);
    result = await bundle(doc as any);
  }
  let deref = await dereference(result);
  generateApi(result as OpenAPIObject, deref as OpenAPIObject);
});

async function convertSwaggerToOpenApi(doc: any) {
  return new Promise((resolve, reject) => {
    converter.convertObj(doc, {}, (err: Error, options: any) => {
      if (err) {
        reject(err);
      }
      resolve(options.openapi);
    });
  });
}
