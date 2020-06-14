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

export class RouteExists extends Error {
  public constructor(methods: RequestMethod[], path: string) {
    super(`Route already exists for: [${methods}] ${path}`);
  }
}

const registry = new Map<string, Route>();

export class Route {
  public readonly methods: RequestMethod[];
  public readonly path: string;

  private readonly keys: Key[];
  private readonly regexp: RegExp;

  public static fresh(methods: RequestMethod[], path: string): Route {
    if (registry.has(cacheKey(methods, path))) {
      throw new RouteExists(methods, path);
    }

    return Route.for(methods, path);
  }
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
    this.regexp = pathToRegexp(this.path, this.keys);
  }

  public test(method: RequestMethod | string, path: string) {
    // check the method...
    const matched = this.methods.includes(method as RequestMethod) ||
      // ... allowing "HEAD" to valid as "GET"
      (method === RequestMethod.HEAD &&
        this.methods.includes(RequestMethod.GET));

    return matched && this.regexp.test(path);
  }
}

function cacheKey(methods?: RequestMethod[], path?: string): string {
  return [Array.isArray(methods) ? methods.sort() : methods, path].join(":");
}
