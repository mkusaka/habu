import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(
	process.cwd(),
	"node_modules/next/dist/server/node-environment-extensions/fast-set-immediate.external.js",
);

const startMarker = "const nodeTimers = require('node:timers');";
const endMarker = "process.nextTick = patchedNextTick;";

const source = await readFile(target, "utf8");

if (source.includes("assignIfWritable(")) {
	console.log("[patch] fast-set-immediate already patched");
	process.exit(0);
}

const startIndex = source.indexOf(startMarker);
const endIndex = source.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
	console.error("[patch] fast-set-immediate patch target not found");
	process.exit(1);
}

const lineStart = source.lastIndexOf("\n", startIndex) + 1;
const indent = source.slice(lineStart, startIndex);
const indent2 = `${indent}    `;
const indent3 = `${indent}        `;
const indent4 = `${indent}            `;

const replacement = [
	`${indent}const nodeTimers = require('node:timers');`,
	`${indent}const assignIfWritable = (obj, key, value) => {`,
	`${indent2}try {`,
	`${indent3}const desc = Object.getOwnPropertyDescriptor(obj, key);`,
	`${indent3}if (!desc) {`,
	`${indent4}if (Object.isExtensible(obj)) {`,
	`${indent4}    obj[key] = value;`,
	`${indent4}}`,
	`${indent4}return;`,
	`${indent3}}`,
	`${indent3}if (desc.writable || desc.set) {`,
	`${indent4}obj[key] = value;`,
	`${indent3}}`,
	`${indent2}} catch {}`,
	`${indent}};`,
	`${indent}// Workaround for missing __promisify__ which is not a real property`,
	`${indent}assignIfWritable(globalThis, 'setImmediate', patchedSetImmediate);`,
	`${indent}assignIfWritable(nodeTimers, 'setImmediate', patchedSetImmediate);`,
	`${indent}assignIfWritable(globalThis, 'clearImmediate', patchedClearImmediate);`,
	`${indent}assignIfWritable(nodeTimers, 'clearImmediate', patchedClearImmediate);`,
	`${indent}const nodeTimersPromises = require('node:timers/promises');`,
	`${indent}assignIfWritable(nodeTimersPromises, 'setImmediate', patchedSetImmediatePromise);`,
	`${indent}${endMarker}`,
].join("\n");

const updated =
	source.slice(0, startIndex) +
	replacement +
	source.slice(endIndex + endMarker.length);

await writeFile(target, updated, "utf8");
console.log("[patch] fast-set-immediate patched");
