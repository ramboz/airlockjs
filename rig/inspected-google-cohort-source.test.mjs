import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { parse } from "../node_modules/acorn/dist/acorn.mjs";
import { describe, expect, it } from "vitest";
import { isSupportedGoogleChromeVersion, isSupportedGoogleCohort } from "./inspected-google-cohort.mjs";

const observed = Object.freeze({ node: "v22.16.0", platform: "darwin", arch: "arm64", darwin: "27.0.0",
  macos: "27.0.1", chrome: "157.0.8103.40", playwright: "1.62.1" });
const producer = readFileSync(new URL("./inspected-google-qualification.mjs", import.meta.url), "utf8");
const producerImport = 'import { currentGoogleCohort, isSupportedGoogleChromeVersion } from "./inspected-google-cohort.mjs";';
const fixedGuard = 'if (!isSupportedGoogleChromeVersion(browser.version())) fail("browser_cohort_mismatch");';

function assertProducerWiring(source) {
  const program = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const imports = program.body.filter(node => node.type === "ImportDeclaration"
    && node.source.value === "./inspected-google-cohort.mjs");
  expect(imports).toHaveLength(1);
  expect(imports[0].specifiers.map(node => [node.type, node.imported?.name, node.local.name]))
    .toEqual([["ImportSpecifier", "currentGoogleCohort", "currentGoogleCohort"],
      ["ImportSpecifier", "isSupportedGoogleChromeVersion", "isSupportedGoogleChromeVersion"]]);
  const functions = program.body.filter(node => node.type === "ExportNamedDeclaration"
    && node.declaration?.type === "FunctionDeclaration" && node.declaration.id?.name === "runLocalGoogleQualification");
  expect(functions).toHaveLength(1);
  const tries = functions[0].declaration.body.body.filter(node => node.type === "TryStatement"
    && node.block.body.some(statement => statement.type === "ExpressionStatement"
      && statement.expression.type === "AssignmentExpression" && statement.expression.left.name === "browser"));
  expect(tries).toHaveLength(1);
  const statements = tries[0].block.body;
  const connected = statements.findIndex(statement => statement.type === "ExpressionStatement"
    && statement.expression.type === "AssignmentExpression" && statement.expression.left.name === "browser");
  expect(connected).toBeGreaterThanOrEqual(0);
  expect(statements[connected]).toMatchObject({ type: "ExpressionStatement", expression: {
    type: "AssignmentExpression", operator: "=", left: { type: "Identifier", name: "browser" },
    right: { type: "AwaitExpression", argument: { type: "CallExpression", callee: { type: "Identifier", name: "wait" },
      arguments: [{ type: "CallExpression", callee: { type: "MemberExpression", computed: false,
        object: { type: "Identifier", name: "chromium" }, property: { type: "Identifier", name: "connect" } } }] } },
  } });
  const guard = statements[connected + 1];
  expect(guard).toMatchObject({ type: "IfStatement", alternate: null, test: {
    type: "UnaryExpression", operator: "!", argument: { type: "CallExpression",
      callee: { type: "Identifier", name: "isSupportedGoogleChromeVersion" }, arguments: [{
        type: "CallExpression", callee: { type: "MemberExpression", computed: false,
          object: { type: "Identifier", name: "browser" }, property: { type: "Identifier", name: "version" } },
        arguments: [],
      }] },
  }, consequent: { type: "ExpressionStatement", expression: { type: "CallExpression",
    callee: { type: "Identifier", name: "fail" }, arguments: [{ type: "Literal", value: "browser_cohort_mismatch" }] } } });
  expect(statements[connected + 2]).toMatchObject({ type: "ExpressionStatement", expression: {
    type: "CallExpression", callee: { type: "MemberExpression", computed: false,
      object: { type: "Identifier", name: "transport" }, property: { type: "Identifier", name: "attachOwnedBrowser" } },
  } });
  const guardText = source.slice(guard.start, guard.end);
  expect(guardText).toBe(fixedGuard);
  return guardText;
}

function runProducerGuard(version) {
  const guard = assertProducerWiring(producer);
  new Script(guard).runInNewContext({
    browser: { version: () => version }, isSupportedGoogleChromeVersion,
    fail: reason => { throw Error(reason); },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
}

describe("connected producer guard source", () => {
  it("uses the fixed cohort predicate immediately after connection", () => {
    assertProducerWiring(producer);
  });

  it.each([
    ["import", producerImport],
    ["guard", fixedGuard],
  ])("rejects a producer with a commented-out %s", (_label, target) => {
    expect(producer.includes(target)).toBe(true);
    const disabled = producer.replace(target, `/*\n${target}\n*/`);
    expect(() => assertProducerWiring(disabled)).toThrow();
  });

  it.each([
    ["157.0.8103.40", true], ["156.0.8078.80", false],
    ["157.0.8103.41", false], ["157.0.8103.40 ", false],
  ])("enforces the connected-browser guard for %s", (version, accepted) => {
    if (accepted) expect(() => runProducerGuard(version)).not.toThrow();
    else expect(() => runProducerGuard(version)).toThrow("browser_cohort_mismatch");
  });
});

describe("fixed Google connected-browser version selector", () => {
  it("accepts the exact observed Chrome157 version", () => {
    expect(isSupportedGoogleChromeVersion("157.0.8103.40")).toBe(true);
  });

  it.each(["156.0.8078.80", "157.0.8103.41", "157.0.8103.40 ", "Chrome/157.0.8103.40",
    "", null, undefined, 157])("rejects stale or malformed version %s", version => {
    expect(isSupportedGoogleChromeVersion(version)).toBe(false);
  });
});

describe("fixed Google cohort source selector", () => {
  it("accepts only the observed Chrome157 cohort", () => {
    expect(isSupportedGoogleCohort(observed)).toBe(true);
  });

  it.each([
    ["chrome", "156.0.8078.80"],
    ["chrome", "157.0.8103.41"],
    ["node", "v22.16.1"],
    ["platform", "linux"],
    ["arch", "x64"],
    ["darwin", "27.0.1"],
    ["macos", "27.0.2"],
    ["playwright", "1.62.0"],
  ])("rejects a mismatched %s pin", (key, value) => {
    expect(isSupportedGoogleCohort({ ...observed, [key]: value })).toBe(false);
  });
});
