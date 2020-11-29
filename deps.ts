export * as flags from "https://deno.land/std@0.79.0/flags/mod.ts";

import { walk } from "https://deno.land/std@0.79.0/fs/walk.ts";
export const fs = {
  walk,
};

export * as http from "https://deno.land/std@0.79.0/http/mod.ts";
export * as path from "https://deno.land/std@0.79.0/path/mod.ts";

export * as pathToRegexp from "https://raw.githubusercontent.com/pillarjs/path-to-regexp/v6.2.0/src/index.ts";
