import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { compilerRoute, runCompiler } from "./typescript-compiler.mjs";

test("native compiler covers the published platforms for checking and emission", () => {
	for (const [platform, arch] of [
		["linux", "x64"],
		["linux", "arm64"],
		["darwin", "arm64"],
	]) {
		for (const mode of ["check", "emit"]) assert.equal(compilerRoute(mode, platform, arch), "tsrs");
	}
});

test("unsupported native platforms retain Bun checks and TypeScript emit/watch", () => {
	for (const [platform, arch] of [
		["win32", "x64"],
		["darwin", "x64"],
		["linux", "arm"],
	]) {
		assert.equal(compilerRoute("check", platform, arch), "bun");
		assert.equal(compilerRoute("emit", platform, arch), "tsc");
	}
});

test("native checking forwards project arguments, disables emission, and preserves diagnostics exit code", () => {
	const calls = [];
	const status = runCompiler("check", ["-p", "tsconfig.json"], {
		platform: "linux",
		arch: "x64",
		resolve: () => join("/deps", "tsrs", "package.json"),
		spawn: (...args) => {
			calls.push(args);
			return { status: 2 };
		},
	});
	assert.equal(status, 2);
	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0][1], [join("/deps", "tsrs", "bin", "tsrs"), "--noEmit", "-p", "tsconfig.json"]);
});

test("emission preserves watch flags and missing binaries never fall back", () => {
	let calls = 0;
	assert.throws(
		() =>
			runCompiler("emit", ["--watch"], {
				platform: "linux",
				arch: "x64",
				resolve: () => join("/deps", "tsrs", "package.json"),
				spawn: (_command, args) => {
					calls++;
					assert.deepEqual(args, [join("/deps", "tsrs", "bin", "tsrs"), "--watch"]);
					return { error: new Error("ENOENT") };
				},
			}),
		/ENOENT/,
	);
	assert.equal(calls, 1);
});

test("terminated compiler cannot report success and invalid modes fail closed", () => {
	assert.equal(
		runCompiler("check", [], {
			platform: "linux",
			arch: "x64",
			resolve: () => join("/deps", "tsrs", "package.json"),
			spawn: () => ({ status: null, signal: "SIGTERM" }),
		}),
		1,
	);
	assert.throws(() => compilerRoute("typo"), /Unknown compiler mode/);
});

test("unsupported platform invokes the existing checker and emitter without shell lookup", () => {
	for (const mode of ["check", "emit"]) {
		const status = runCompiler(mode, ["-p", "project.json"], {
			platform: "win32",
			arch: "x64",
			resolve: () => join("/deps", "typescript", "package.json"),
			spawn: (command, args) => {
				assert.equal(command, process.execPath);
				assert.ok(args[0].endsWith(mode === "check" ? "bun-typecheck.mjs" : join("typescript", "bin", "tsc")));
				assert.deepEqual(args.slice(1), ["-p", "project.json"]);
				return { status: 3 };
			},
		});
		assert.equal(status, 3);
	}
});

test("uninstalled native compiler fails before spawning an alternative", () => {
	assert.throws(
		() =>
			runCompiler("check", [], {
				platform: "linux",
				arch: "x64",
				resolve: () => {
					throw new Error("Cannot find module tsrs");
				},
				spawn: () => assert.fail("must not spawn an alternative compiler"),
			}),
		/Cannot find module tsrs/,
	);
});
