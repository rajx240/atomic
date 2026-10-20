#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export function compilerRoute(mode, platform = process.platform, arch = process.arch) {
	if (mode !== "check" && mode !== "emit") throw new Error(`Unknown compiler mode: ${mode}`);
	const nativeSupported =
		(platform === "linux" && (arch === "x64" || arch === "arm64")) || (platform === "darwin" && arch === "arm64");
	return nativeSupported ? "tsrs" : mode === "check" ? "bun" : "tsc";
}

export function runCompiler(mode, args, { platform, arch, spawn = spawnSync, resolve = require.resolve } = {}) {
	const route = compilerRoute(mode, platform, arch);
	let entry;
	let compilerArgs = args;
	if (route === "tsrs") {
		entry = join(dirname(resolve("tsrs/package.json")), "bin", "tsrs");
		if (mode === "check") compilerArgs = ["--noEmit", ...args];
	} else if (route === "bun") {
		entry = fileURLToPath(new URL("./bun-typecheck.mjs", import.meta.url));
	} else {
		entry = join(dirname(resolve("typescript/package.json")), "bin", "tsc");
	}
	// Route by platform only: errors and missing native binaries must never trigger a fallback.
	const result = spawn(process.execPath, [entry, ...compilerArgs], { stdio: "inherit" });
	if (result.error) throw result.error;
	return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		process.exitCode = runCompiler(process.argv[2], process.argv.slice(3));
	} catch (error) {
		console.error(`typescript-compiler: ${error.message}`);
		process.exitCode = 1;
	}
}
