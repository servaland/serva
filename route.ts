import { pathToRegexp, Key } from "./deps.ts";

export enum RequestMethod {
  GET = "GET",
  HEAD = "HEAD",
  POST = "POST",
  PUT = "PET",
  DELETE = "DELETE",
  OPTIONS = "OPTIONS",
  PATCH = "PATCH",
}

const registry = new Map<string, Route>();

const wildcardRegexp = /(\/\*)$/;

export class Route {
  public readonly methods: RequestMethod[];
  public readonly path: string;

  private readonly keys: Key[];
  private readonly regexp: RegExp;

  public static for(methods: RequestMethod[], path: string): Route {
    const key = cacheKey(methods, path);
    let route = registry.get(key);

    if (!route) {
      route = new Route(methods, path);
      registry.set(key, route);
    }

    return route;
  }

  public constructor(
    methods: RequestMethod[],
    path: string,
  ) {
    this.methods = methods;
    this.path = path;
    this.keys = [];
    this.regexp = pathToRegexp(cleanPath(this.path), this.keys, {
      end: !wildcardRegexp.test(this.path),
    });
  }

  public test(method: RequestMethod | string, path: string) {
    // check the method...
    const matched = this.methods.includes(method as RequestMethod) ||
      // ... allowing "HEAD" to valid as "GET"
      (method === RequestMethod.HEAD &&
        this.methods.includes(RequestMethod.GET));

    return matched && this.regexp.test(path);
  }

  public params(path: string): [string | number, string][] {
    const matches = this.keys.length > 0 ? this.regexp.exec(path) : null;

    return matches
      ? matches
        .slice(1, this.keys.length + 1)
        .reduce(
          (current, value, index) =>
            current.concat([[this.keys[index].name, value]]),
          [] as [string | number, string][],
        )
      : [];
  }
}

function cacheKey(methods?: RequestMethod[], path?: string): string {
  return [Array.isArray(methods) ? methods.sort() : methods, path].join(":");
}

function cleanPath(path: string): string {
  // /path/* => /path
  let cleaned = path.replace(wildcardRegexp, "");

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
