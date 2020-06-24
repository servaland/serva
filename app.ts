import { walk } from "https://deno.land/std@0.57.0/fs/walk.ts";
import {
  serve,
  Server,
  ServerRequest,
} from "https://deno.land/std@0.57.0/http/mod.ts";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "https://deno.land/std@0.57.0/path/mod.ts";
import createRoute, { Route } from "./_route.ts";
import { HookCallback, RouteCallback, registerRoute } from "./registers.ts";

const ROUTES_DIR = "routes";
const FILE_EXT = ".ts";

type RoutesMap = Map<Route, HookCallback[]>;
type RoutesStruct = Map<string, RoutesMap>;

export default class App {
  private readonly routes: RoutesStruct = new Map();
  private readonly server: Server;

  public readonly appPath: string;

  public constructor(appPath: string) {
    this.appPath = appPath;
    this.server = serve({
      port: 4500,
    });
  }

  public path(...path: string[]): string {
    if (path.length === 0) {
      return this.appPath;
    }

    if (path.length === 1 && isAbsolute(path[0])) {
      return path[0];
    }

    return resolve(this.appPath, ...path);
  }

  public async start() {
    await this.mount();

    for await (const request of this.server) {
      this.handleRequest(request);
    }
  }

  private async mount(): Promise<void> {
    const routesPath = this.path(ROUTES_DIR);

    // clear on remounts
    this.routes.clear();

    for await (const entry of walk(routesPath)) {
      // ignore directories and any non-typescript files
      // todo: support for javascript
      if (entry.isDirectory || !entry.name.endsWith(FILE_EXT)) {
        continue;
      }

      // route information
      const relativeEntryPath = relative(routesPath, entry.path);
      const route = createRoute(
        routeMethod(relativeEntryPath),
        routePath(relativeEntryPath),
        entry.path,
      );

      // register route
      let routeFactory: any;
      try {
        ({ default: routeFactory } = await import(entry.path));
        if (typeof routeFactory !== "function") {
          throw new TypeError(
            `file://${route.filePath} default export is not a callback.`,
          );
        }
      } catch (err) {
        console.log("Error in file:", entry.path, err);
        continue;
      }

      let hooks: HookCallback[];
      let callback: RouteCallback;

      // developer wrapped it with `registerRoute`
      if (routeFactory[Symbol.for("serva.route_factory")]) {
        // run and destruct the routeFactory
        [hooks, callback] = await routeFactory(route);
      } else {
        // auto-wrap, lazy
        [hooks, callback] = await registerRoute(routeFactory)(route);
      }

      // set routes
      const methods: RoutesMap = this.routes.get(route.method) || new Map();
      methods.set(route, [...hooks, wrapRouteCallback(route, callback)]);
      this.routes.set(route.method, methods);
    }
  }

  private async handleRequest(request: ServerRequest): Promise<void> {
    // todo: use host from header
    const url = new URL(request.url, "https://serva.land");

    // find a matching route
    let route: Route | null = null;
    let stack: HookCallback[] = [];

    for (const [method, map] of this.routes) {
      if (method === request.method || method === "*") {
        for (const r of map.keys()) {
          if (r.regexp.test(url.pathname)) {
            route = r;
            stack = map.get(r)!;
            // route found
            break;
          }
        }
      }
    }

    // not found
    if (!route) {
      request.respond({
        status: 404,
      });
      return;
    }

    try {
      await dispatch(stack, request);
    } catch (err) {
      // todo: error handling
      throw err;
    }
  }
}

async function dispatch(
  callbacks: (HookCallback)[],
  request: ServerRequest,
): Promise<any> {
  let i = -1;

  const next = (current = 0): Promise<any> => {
    if (current <= i) {
      throw new Error("next() already called");
    }

    const cb = callbacks[i = current];

    return Promise.resolve(
      cb ? cb(request, next.bind(undefined, i + 1)) : undefined,
    );
  };

  return next();
}

/**
 * Gets the route path from a file path.
 * 
 * @example
 *   routePath("index.ts");
 *   // => "/"
 * 
 *   routePath("comments/[comment].get.ts");
 *   // => "/comments/[comment]"
 * 
 * @param {string} path
 * @returns {string}
 */
function routePath(path: string): string {
  let name = basename(path, FILE_EXT);
  const matched = name.match(
    /.*(?=\.(get|post|put|options|delete|patch)$)/i,
  );

  if (matched) {
    [name] = matched;
  }

  if (name === "index") {
    name = "";
  }

  let base = dirname(path);
  if (base === ".") {
    base = "";
  }

  return "/" + (base ? join(base, name) : name);
}

/**
 * Returns the route method from a give route path.
 * 
 * @example
 *   routeMethod("index.ts");
 *   // => "*"
 * 
 *   routeMethod("/comments/[comment].get.ts")
 *   // => "GET"
 *  
 * @param {string} path The route path with no extensions
 * @returns {string}
 */
function routeMethod(path: string): string {
  const name = basename(path, FILE_EXT);
  const matched = name.match(
    /.*(?=\.(get|post|put|options|delete|patch)$)/i,
  );

  let method = "*";
  if (matched) {
    [, method] = matched;
  }

  return method.toUpperCase();
}

/**
 * Wraps a route callback returning a hook callback.
 * 
 * @param {Route} route 
 * @param {RouteCallback} callback
 * @returns {HookCallback} 
 */
function wrapRouteCallback(
  route: Route,
  callback: RouteCallback,
): HookCallback {
  return async (request, next) => {
    const params = route.params(
      new URL(request.url, "https://serva.land").pathname,
    );

    await callback(request, params || {});

    return next();
  };
}
