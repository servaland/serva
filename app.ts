import createRequest, { ServaRequest } from "./_request.ts";
import createRoute, { Route } from "./_route.ts";
import { fs, http, path } from "./deps.ts";

const METHODS_AVAILABLE = "get|post|put|delete|patch";
const ROUTES_DIR = "routes";
const FILE_EXT = ".ts";

export interface RouteCallback {
  (request: ServaRequest): Promise<any> | any;
}

type RouteEntry = [Route, RouteCallback];
type RoutesStruct = Map<string, RouteEntry[]>;

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

    const routes: [string, RouteEntry][] = [];

    for await (const entry of fs.walk(routesPath)) {
      // ignore directories and any non-typescript files
      // todo: support for javascript
      if (entry.isDirectory || !entry.name.endsWith(FILE_EXT)) {
        continue;
      }

      const relativeEntryPath = path.relative(routesPath, entry.path);
      const method = routeMethod(relativeEntryPath);
      const urlPath = routePath(relativeEntryPath); // route information
      const route = createRoute(
        method,
        urlPath,
        entry.path,
      );

      // register route
      let callback: RouteCallback;
      try {
        let filePath = entry.path;
        if (remount) {
          filePath += "#" + Math.random();
        }

        ({ default: callback } = await import(filePath));
        if (typeof callback !== "function") {
          throw new TypeError(
            `file://${route.filePath} default export is not a callback.`,
          );
        }
      } catch (err) {
        console.log("Error in file:", entry.path, err);
        continue;
      }

      routes.push(
        [
          route.method,
          [route, callback!],
        ],
      );
    }

    // sort the routes
    routes.sort(sortRoutes);

    // replace routes
    this.routes.clear();
    routes.forEach(([method, entry]) => {
      const entries = this.routes.get(method) || [];
      entries.push(entry);

      if (entries.length === 1) {
        this.routes.set(method, entries);
      }
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
    let route: Route;
    let callback: RouteCallback;
    const { pathname } = new URL(req.url, "https://serva.land");

    const possibleMethods = [req.method, "*"];
    if (req.method === "HEAD") {
      possibleMethods.splice(0, 1, "GET");
    }

    possibleMethods.some((m) => {
      const entries = this.routes.get(m);
      if (entries) {
        return entries.some(([r, cb]) => {
          if (r.regexp.test(pathname)) {
            route = r;
            callback = cb;
            // route found
            return true;
          }
        });
      }
    });

    // not found
    // @ts-ignore
    if (!route) {
      req.respond({
        status: 404,
      });
      return;
    }

    const request = createRequest(req, route);
    const body = await callback!(request);

    // allow return values to set the body
    if (body !== undefined) {
      request.respond({ body });
    }

    // if nobody has responded, send the current request's response
    if (!request.responded) {
      req.respond(request.response);
    }
  }
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
 * Sort function for routes.
 *
 * @param {RouteEntry} a
 * @param {RouteEntry} b
 * @returns {number}
 */
function sortRoutes(a: [string, RouteEntry], b: [string, RouteEntry]): number {
  const [methodA, [routeA]] = a;
  const [methodB, [routeB]] = b;

  // find params and insert placeholders
  const pathA = routeA.path.replace(/\[.+\]/g, "\0");
  const pathB = routeB.path.replace(/\[.+\]/g, "\0");

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
  if (methodA === "*" || methodB === "*") {
    return methodB.charCodeAt(0) - methodA.charCodeAt(0);
  }

  return 0;
}
