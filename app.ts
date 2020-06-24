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
import createRequest, { ServaRequest } from "./_request.ts";
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
    this.appPath = resolve(appPath);
    this.server = serve({
      port: 4500,
    });
  }

  /**
   * Returns a path relative to the `appPath`. Or the absolute path if specified.
   *
   * @public
   * @param {...string[]} path
   * @returns {string}resolve
   */
  public path(...path: string[]): string {
    if (path.length === 0) {
      return this.appPath;
    }

    if (path.length === 1 && isAbsolute(path[0])) {
      return path[0];
    }

    return join(this.appPath, ...path);
  }

  /**
   * Starts the application.
   *
   * @public
   * @returns {Promise<void>}
   */
  public async start() {
    await this.mount();

    for await (const request of this.server) {
      this.handleRequest(request);
    }
  }

  public remount() {
    this.mount(true);
  }

  /**
   * Mounts the application to the `appPath`.
   * 
   * @private
   * @returns {Promise<void>}
   */
  private async mount(remount: boolean = false): Promise<void> {
    const routesPath = this.path(ROUTES_DIR);

    // clear on remounts
    this.routes.clear();

    try {
      const lstats = await Deno.lstat(routesPath);
      if (!lstats.isDirectory) {
        throw new Error();
      }
    } catch (err) {
      throw new Error(`${routesPath} not found`);
    }

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
        let filePath = entry.path;
        if (remount) {
          filePath += "?_" + Math.random();
        }

        ({ default: routeFactory } = await import(filePath));
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

  /**
   * Handles an incoming request from the server.
   * 
   * @private
   * @param {ServerRequest} req
   * @returns {<Promise<void>} 
   */
  private async handleRequest(req: ServerRequest): Promise<void> {
    // find a matching route
    let route: Route | null = null;
    let stack: HookCallback[] = [];
    const { pathname } = new URL(req.url, "https://serva.land");

    for (const [method, map] of this.routes) {
      if (method === req.method || method === "*") {
        for (const r of map.keys()) {
          if (r.regexp.test(pathname)) {
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
      req.respond({
        status: 404,
      });
      return;
    }

    const request = createRequest(req, route);

    try {
      await dispatch(stack, request);
    } catch (err) {
      // todo: error handling
      throw err;
    } finally {
      // if nobody has responded, send the current request's response
      if (!request.responded) {
        req.respond(request.response);
      }
    }
  }
}

/**
 * Dispatch the callback stack with a given request object.
 *
 * @example
 *   async function one(request, next) {
 *     console.log("enter: one");
 *     await next();
 *     console.log("exit: one");
 *   }
 *
 *   async function two(request, next) {
 *     console.log("enter: two");
 *     await next();
 *     console.log("exit: two");
 *   }
 *
 *   await dispatch([one, two], request);
 *   // => "enter: one"
 *   // => "enter: two"
 *   // => "exit: two"
 *   // => "exit: one"
 *
 * @param {CallbackHook[]} callbacks
 * @param {ServaRequest} request
 * @returns {Promise<any>}
 */
async function dispatch(
  callbacks: (HookCallback)[],
  request: ServaRequest,
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
    const params = route.params(request.url.pathname);
    const body = await callback(request, params || {});

    // if no middleware or the route itself has responded and it returned a body
    // then add the body to the request's response
    if (body !== undefined) {
      request.respond({ body });
    }

    return next();
  };
}
