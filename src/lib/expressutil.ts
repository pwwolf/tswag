//swagger paths use {blah} while express uses :blah
export function convertPathToExpress(swaggerPath: string) {
  const reg = /\{([^\}]+)\}/g; //match all {...}
  swaggerPath = swaggerPath.replace(reg, ":$1");
  return swaggerPath;
}
