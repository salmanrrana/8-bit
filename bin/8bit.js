#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, "../dist/index.js");
const entry = existsSync(dist) ? dist : join(dir, "../src/index.ts");
await import(pathToFileURL(entry).href);
