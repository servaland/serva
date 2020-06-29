import createRequest, { ServaRequest } from "./_request.ts";
import createRoute, { Route } from "./_route.ts";
import { fs, http, path } from "./deps.ts";

const METHODS_AVAILABLE = "get|post|put|options|delete|patch";
const ROUTES_DIR = "routes";
const HOOKS_FILENAME = "_hooks";
const FILE_EXT = ".ts";
const HOOKS_REGEXP = new RegExp(
  `${HOOKS_FILENAME}(\\.(${METHODS_AVAILABLE}))?\\${FILE_EXT}$`,
);

interface NextCallback {
  (): Promise<any>;
}

interface HookCallback {
  (request: ServaRequest, next: NextCallback): Promise<any> | any;
}

export interface RouteCallback {
  (request: ServaRequest): Promise<any> | any;
}

type RoutesMap = Map<Route, HookCallback[]>;
type RoutesStruct = Map<string, RoutesMap>;
type RouteEntry = [string, [Route, HookCallback[]]];

export default class App {
  private readonly routes: RoutesStruct = new Map();
  private readonly server: http.Server;

  public readonly appPath: string;

  public constructor(appPath: string) {
    this.appPath = path.resolve(appPath);
    this.server = http.serve({
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
  public path(...paths: string[]): string {
    if (paths.length === 0) {
      return this.appPath;
    }

    if (paths.length === 1 && path.isAbsolute(paths[0])) {
      return paths[0];
    }

    return path.join(this.appPath, ...paths);
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

    const routes: RouteEntry[] = [];
    const globalHooks: RouteEntry[] = [];

    for await (const entry of fs.walk(routesPath)) {
      // ignore directories and any non-typescript files
      // todo: support for javascript
      if (entry.isDirectory || !entry.name.endsWith(FILE_EXT)) {
        continue;
      }

      const relativeEntryPath = path.relative(routesPath, entry.path);
      const hooksFile = HOOKS_REGEXP.test(relativeEntryPath);
      const method = routeMethod(relativeEntryPath);
      const urlPath = routePath(relativeEntryPath); // route information
      const route = createRoute(
        method,
        urlPath,
        entry.path,
      );

      // register route
      let routeFactory: any;
      try {
        let filePath = entry.path;
        if (remount) {
          filePath += "#" + Math.random();
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

      const factory = (routeFactory[Symbol.for("serva.route_factory")] ||
        routeFactory[Symbol.for("serva.hooks_factory")])
        ? routeFactory
        : (hooksFile
          ? registerHooks(routeFactory)
          : registerRoute(routeFactory));

      if (hooksFile) {
        hooks = await factory(route);
      } else {
        [hooks, callback] = await factory(route);
      }

      // set routes/hooks
      if (hooksFile) {
        globalHooks.push([
          route.method,
          [route, hooks],
        ]);
      } else {
        routes.push(
          [
            route.method,
            [route, [...hooks, wrapRouteCallback(route, callback!)]],
          ],
        );
      }
    }

    // sort the routes
    globalHooks.sort(sortRoutes);
    routes.sort(sortRoutes);

    // merge global hooks to routes
    routes.forEach((entry) => {
      const [method, [route, hooks]] = entry;
      const methodRoutes = this.routes.get(method) || new Map();

      // fake route path
      const pathLike = route.path.replace(/\[.+\]/g, "a");

      // test the hooks path if it matches the route path
      // @todo: clean this code up, looks messy
      const injectedHooks = globalHooks.filter((entry) => {
        const [hookMethod] = entry;
        return (hookMethod === method || hookMethod === "*") &&
          entry[1][0].regexp.test(pathLike);
      }).map((entry) => entry[1][1]).reduce(
        (all, hooks) => all.concat(hooks),
        [],
      );

      methodRoutes.set(route, injectedHooks.concat(hooks));
      this.routes.set(method, methodRoutes);
    });
  }

  /**
   * Handles an incoming request from the server.
   * 
   * @private
   * @param {ServerRequest} req
   * @returns {<Promise<void>} 
   */
  private async handleRequest(req: http.ServerRequest): Promise<void> {
    // find a matching route
    let route: Route | null = null;
    let stack: HookCallback[] = [];
    const { pathname } = new URL(req.url, "https://serva.land");

    const possibleMethods = [req.method, "*"];
    if (req.method === "HEAD") {
      possibleMethods.splice(0, 1, "GET");
    }

    possibleMethods.some((m) => {
      const routes = this.routes.get(m);
      if (routes) {
        for (const r of routes.keys()) {
          if (r.regexp.test(pathname)) {
            route = r;
            stack = routes.get(r)!;
            // route found
            return true;
          }
        }
      }
    });

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
function routePath(filePath: string): string {
  let name = path.basename(filePath, FILE_EXT);
  const matched = name.match(
    new RegExp(`.*(?=\.(${METHODS_AVAILABLE})$)`, "i"),
  );

  if (matched) {
    [name] = matched;
  }

  if (name === "index") {
    name = "";
  } else if (name === HOOKS_FILENAME) {
    name = "*";
  }

  let base = path.dirname(filePath);
  if (base === ".") {
    base = "";
  }

  return "/" + (base ? path.join(base, name) : name);
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
 * @param {string} filePath The route path with no extensions
 * @returns {string}
 */
function routeMethod(filePath: string): string {
  const name = path.basename(filePath, FILE_EXT);
  const matched = name.match(
    new RegExp(`.*(?=\.(${METHODS_AVAILABLE})$)`, "i"),
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
  callback: RouteCallback,
): HookCallback {
  return async (request, next) => {
    const body = await callback(request);

    // if no middleware or the route itself has responded and it returned a body
    // then add the body to the request's response
    if (body !== undefined) {
      request.respond({ body });
    }

    return next();
  };
}

/**
 * Sort function for routes.
 *
 * @param {RouteEntry} a
 * @param {RouteEntry} b
 * @returns {number}
 */
function sortRoutes(a: RouteEntry, b: RouteEntry): number {
  // find params and insert placeholders
  const pathA = a[1][0].path.replace(/\[.+\]/g, "\0");
  const pathB = b[1][0].path.replace(/\[.+\]/g, "\0");

  // compare each character of the urls
  for (let i = 0, l = Math.min(pathA.length, pathB.length); i < l; ++i) {
    const aChar = pathA.charAt(i);
    const bChar = pathB.charAt(i);

    if (aChar !== bChar) {
      // param check
      if (aChar === "\0") {
        return 1;
      } else if (bChar === "\0") {
        return -1;
      }

      // order by least path segments
      return pathA.split(path.sep).length - pathB.split(path.sep).length;
    }
  }

  // compare methods
  if (a[0] === "*" || b[0] === "*") {
    return b[0].charCodeAt(0) - a[0].charCodeAt(0);
  }

  return 0;
}
