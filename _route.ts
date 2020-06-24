import {
  pathToRegexp,
  Key,
  match,
} from "https://raw.githubusercontent.com/pillarjs/path-to-regexp/v6.1.0/src/index.ts";

export interface Route {
  readonly filePath: string;
  readonly method: string;
  readonly path: string;
  readonly regexp: RegExp;
  readonly paramNames: (string | number)[];
  params: (path: string) => Map<string, string>;
}

/**
 * Creates a new route object.
 *
 * @param {string} method
 * @param {string} path
 * @param {string} filePath
 * @returns {Route}
 */
export default function create(
  method: string,
  path: string,
  filePath: string,
): Route {
  const cleaned = cleanPath(path);
  const keys: Key[] = [];
  const regexp = pathToRegexp(cleaned, keys);
  const paramNames = keys.map((key) => key.name);
  const matcher = match(cleaned);

  return {
    filePath,
    path,
    method,
    regexp,
    paramNames,
    params(path: string): Map<string, string> {
      const matches = matcher(path);
      return new Map(matches ? Object.entries(matches.params) : []);
    },
  };
}

/**
 * Cleans a Serva path into a path-to-regexp path.
 *
 * @example
 *   cleanPath("/comments/[comment]");
 *   // => "/comments/:comment"
 *
 * @param {string} path
 * @returns {string}
 */
function cleanPath(path: string): string {
  let cleaned = path;

  // /[param] => /:param
  const split = cleaned.split("[");
  if (split.length > 1) {
    cleaned = split.reduce(
      (res, token, index) =>
        [res, index > 0 ? ":" : "", token.replace(/\]/, "")].join(""),
      "",
    );
  }

  return cleaned || "/"; // "" => "/"
}
