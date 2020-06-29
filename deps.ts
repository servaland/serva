export { parse, Args } from "https://deno.land/std@0.57.0/flags/mod.ts";

// fs contains unstable features just re-export under fs
import { walk } from "https://deno.land/std@0.57.0/fs/walk.ts";
export const fs = { walk };

export * as http from "https://deno.land/std@0.57.0/http/mod.ts";

export * as path from "https://deno.land/std@0.57.0/path/mod.ts";

export * as pathToRegexp from "https://raw.githubusercontent.com/pillarjs/path-to-regexp/v6.1.0/src/index.ts";
