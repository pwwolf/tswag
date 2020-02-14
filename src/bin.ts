#!/usr/bin/env node

import { bundle, dereference } from "swagger-parser";
import { generateApi } from "./lib/codegen/generator";
import * as minimist from "minimist";
import { stat } from "fs";
import { OpenAPIObject } from "openapi3-ts";
import { createWriteStream, createReadStream } from "fs";
const converter = require("swagger2openapi");

const pj = require("../package.json");
const tstubVersion = pj.version;

const argv = minimist(process.argv.slice(2));

if (argv._.length < 1) {
  console.warn("Must provide path to OpenAPI spec as an argument");
  printUsage();
  process.exit(0);
}

function printUsage() {
  console.log(
    `
Usage: tstub [schema file] [OPTION]...

Options are:
  -o file    Write results to output instead of stdout
  -f         Write output regardless of whether schemas has changed
`
  );
}

stat(argv._[0], async (err, stats) => {
  if (err) {
    console.warn(`${argv._[0]} does not exist.`);
    process.exit(0);
  }

  let out: { write: (chunk: any) => any } = process.stdout;
  if (argv.o) {
    let outputPath: string = argv.o;

    // If -f is specified, we always write to the file
    // Otherwise, check to see if the version of the output file matches
    // the current version of tstub. If it doesn't write the file.
    // If the versions do match, check the timestamps of the output file
    // againt the schema to see if it needs to be regenerated.
    if (argv.f) {
      out = createWriteStream(outputPath);
    } else {
      let versionUsed = await getVersionUsed(outputPath);
      if (versionUsed !== tstubVersion) {
        //Need to regen
        out = createWriteStream(outputPath);
      } else {
        //Let's compare last modified dates
        let schemaDate = await getLastUpdate(argv._[0]);
        let tsDate = await getLastUpdate(outputPath);
        if (schemaDate && tsDate) {
          if (schemaDate.getTime() > tsDate.getTime()) {
            out = createWriteStream(outputPath);
          } else {
            console.log("Skipping - not modified");
            return;
          }
        }
      }
    }
  }

  let result = await bundle(argv._[0]);
  if ((result as any)["swagger"]) {
    console.warn("Converting Swagger 2.0 doc to OpenAPI 3.0");
    let doc = await convertSwaggerToOpenApi(result);
    result = await bundle(doc as any);
  }
  let deref = await dereference(result);

  //Write the version in a comment at the top of the file
  out.write(`// tstub ${tstubVersion}\n`);
  generateApi(result as OpenAPIObject, deref as OpenAPIObject, out);
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

/**
 * Try to read the version comment from top of generated schema
 * Will look like
 * // tstub X.X.X
 */
async function getVersionUsed(path: string) {
  return new Promise((resolve, reject) => {
    stat(path, (err, res) => {
      if (err) {
        //return undefined if file doesn't exit
        return resolve();
      }

      let read = createReadStream(path);
      read.on("readable", () => {
        //32 chars should be plenty to read // tstub X.X.X
        let buf = read.read(32);
        if (!buf) {
          return resolve();
        }
        let chars = (buf as Buffer).toString("utf-8");
        let lines = chars.split("\n");
        let version = lines[0].substring(9);
        resolve(version);
      });
    });
  });
}

//Get the last modified timestamp of the file at the given path
async function getLastUpdate(path: string): Promise<Date | undefined> {
  return new Promise((resolve, reject) => {
    stat(path, (err, res) => {
      if (err) {
        //return undefined if file doesn't exit
        return resolve();
      }
      return resolve(res.mtime);
    });
  });
}
