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
  params: (path: string) => object | null;
}

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
    params(path: string): object | null {
      const matches = matcher(path);
      return matches ? matches.params : null;
    },
  };
}

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
