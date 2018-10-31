#!/usr/bin/env node

import { bundle, parse, dereference } from "swagger-parser";
import { OpenApiSpec } from "@loopback/openapi-v3-types";
import { generateApi } from "./lib/codegen/generator";
import * as minimist from "minimist";
import { stat } from "fs";

const argv = minimist(process.argv.slice(2));

if (argv._.length < 1) {
  console.warn("");
  process.exit(0);
}

stat(argv._[0], (err, stats) => {
  if (err) {
    console.warn(`${argv._[0]} does not exist.`);
    process.exit(0);
  }

  bundle(argv._[0]).then(result => {
    dereference(result).then(deref => {
      generateApi(result as OpenApiSpec, deref as OpenApiSpec);
    });
  });
});
