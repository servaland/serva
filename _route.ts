import {
  pathToRegexp,
  Key,
  match,
} from "./deps.ts";

export interface Route {
  readonly filePath: string;
  readonly method: string;
  readonly path: string;
  readonly regexp: RegExp;
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
  const glob = path.endsWith("/*");
  const cleaned = cleanPath(path);
  const keys: Key[] = [];
  const regexp = pathToRegexp(cleaned, keys, {
    end: !glob,
  });
  const matcher = match(cleaned);

  return {
    filePath,
    path,
    method,
    regexp,
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
 *   cleanPath("/comments/*");
 *   // => "/comments"
 *
 * @param {string} path
 * @returns {string}
 */
function cleanPath(path: string): string {
  let cleaned = path.replace(/\/\*$/, "");

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
