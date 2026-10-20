// @ts-nocheck
import { describe, test } from "vitest";
import {
	assert,
	installSlashDispatchTestHooks,
	parseWorkflowArgs,
	tokenizeWorkflowArgs,
} from "./slash-dispatch-utils.js";

installSlashDispatchTestHooks();

describe("parseWorkflowArgs", () => {
	test("empty tokens → empty object", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs([]), {});
	});

	test("parses key=value string pairs", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs(["prompt=hello world"]), {
			prompt: "hello world",
		});
	});

	test("multiple key=value pairs", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs(["a=1", "b=foo"]), {
			a: 1,
			b: "foo",
		});
	});

	test("JSON-typed values: number, boolean", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs(["count=42", "flag=true"]), {
			count: 42,
			flag: true,
		});
	});

	test("value with = in it splits on first = only", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs(["url=http://x.com/a=b"]), {
			url: "http://x.com/a=b",
		});
	});

	test("JSON object token merged into result", { concurrent: false }, () => {
		const result = parseWorkflowArgs(['{"key":"val","n":3}']);
		assert.deepEqual(result, { key: "val", n: 3 });
	});

	test("JSON object merged with key=value", { concurrent: false }, () => {
		const result = parseWorkflowArgs(['{"a":1}', "b=two"]);
		assert.deepEqual(result, { a: 1, b: "two" });
	});

	test("tokens without = are ignored", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs(["positional", "another"]), {});
	});

	test("key with empty value", { concurrent: false }, () => {
		assert.deepEqual(parseWorkflowArgs(["name="]), { name: "" });
	});
});

// ---------------------------------------------------------------------------
// tokenizeWorkflowArgs
// ---------------------------------------------------------------------------

describe("tokenizeWorkflowArgs", () => {
	test("empty string → empty array", { concurrent: false }, () => {
		assert.deepEqual(tokenizeWorkflowArgs(""), []);
	});

	test("whitespace-only string → empty array", { concurrent: false }, () => {
		assert.deepEqual(tokenizeWorkflowArgs("   \t  "), []);
	});

	test("plain whitespace split for bare tokens", { concurrent: false }, () => {
		assert.deepEqual(tokenizeWorkflowArgs("workflow-name a=1 b=foo"), ["workflow-name", "a=1", "b=foo"]);
	});

	test("double-quoted value preserves internal whitespace", { concurrent: false }, () => {
		// Regression: `prompt="map the codebase"` used to split into three
		// tokens (`prompt="map`, `the`, `codebase"`), which then rendered as
		// `prompt=""map"` in the dispatch confirm card.
		assert.deepEqual(tokenizeWorkflowArgs('workflow-name prompt="map the codebase" max=4'), [
			"workflow-name",
			'prompt="map the codebase"',
			"max=4",
		]);
	});

	test("single-quoted value preserves internal whitespace", { concurrent: false }, () => {
		assert.deepEqual(tokenizeWorkflowArgs("wf prompt='hello there' n=2"), ["wf", "prompt='hello there'", "n=2"]);
	});

	test("nested quotes of the opposite kind are treated as literal characters", { concurrent: false }, () => {
		assert.deepEqual(tokenizeWorkflowArgs(`wf msg="she said 'hi'"`), ["wf", `msg="she said 'hi'"`]);
	});

	test("unterminated quote is recovered as a single tail token", { concurrent: false }, () => {
		// The user can paste a partial value mid-typing; we never throw on
		// their input, the downstream JSON parse just falls back to string.
		assert.deepEqual(tokenizeWorkflowArgs('wf prompt="map the codebase'), ["wf", 'prompt="map the codebase']);
	});

	test("collapses runs of whitespace", { concurrent: false }, () => {
		assert.deepEqual(tokenizeWorkflowArgs("a   b\t\tc"), ["a", "b", "c"]);
	});

	test("end-to-end: tokenize + parse unquotes the string value", { concurrent: false }, () => {
		const tokens = tokenizeWorkflowArgs('fan-out-and-synthesize prompt="map the codebase" max_branches=4');
		assert.deepEqual(tokens, ["fan-out-and-synthesize", 'prompt="map the codebase"', "max_branches=4"]);
		assert.deepEqual(parseWorkflowArgs(tokens.slice(1)), {
			prompt: "map the codebase",
			max_branches: 4,
		});
	});
});

// ---------------------------------------------------------------------------
// Shared test factory helpers
