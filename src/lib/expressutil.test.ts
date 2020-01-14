import { convertPathToExpress } from "./expressutil";

test("expect swagger variables to be replaced with express variables", () => {
  const toConvert = "/this/is/a/{test}/of/path/{params}";
  let result = convertPathToExpress(toConvert);
  expect(result).toBe("/this/is/a/:test/of/path/:params");
});

test("expect path with no variables to be unchanged", () => {
  const toConvert = "/test";
  let result = convertPathToExpress(toConvert);
  expect(result).toBe(toConvert);
});

test("expect empty path to be unchanged", () => {
  const toConvert = "/";
  let result = convertPathToExpress(toConvert);
  expect(result).toBe(toConvert);
});
