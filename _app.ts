import { RouteFactory } from "./_factories.ts";
import createRequest, { ServaRequest } from "./_request.ts";
import createRoute, { Route } from "./_route.ts";
import { fs, http, path, flags } from "./deps.ts";

export interface OnRequestCallback {
  (request: ServaRequest, next: () => Promise<any>): Promise<any> | any;
}

export interface RouteCallback {
  (request: ServaRequest): Promise<any> | any;
}

export interface ServaConfig {
  port: number;
  hostname?: string;
  extension: string;
  methods: string[];
}

const ROUTES_DIR = "routes";

const DEFAULT_CONFIG = Object.freeze({
  port: 4500,
  extension: ".ts",
  methods: "get|post|put|delete|patch".split("|"),
});

type RouteEntry = [Route, OnRequestCallback[]];
type RoutesStruct = Map<string, RouteEntry[]>;

export default class App {
  private readonly routes: RoutesStruct = new Map();
  private readonly server?: http.Server;

  public readonly appPath: string;
  public readonly config: ServaConfig = Object.assign({}, DEFAULT_CONFIG);

  /**
   * Run main.
   * 
   * @param {string[]} args
   * @returns {void}
   */
  public static main(args: string[]): App {
    const { _: [command, dir = "."], port, hostname } = flags.parse(args);

    if (command !== "start") {
      throw new Error(`Unknown command: ${command}`);
    }

    const overwrites: Partial<ServaConfig> = {};

    if (port) {
      overwrites.port = port;
    }

    if (hostname) {
      overwrites.hostname = hostname;
    }

    const app = new this(dir.toString(), overwrites);
    app.start();

    return app;
  }

  /**
   * Creates a new App instance.
   * 
   * @param {string} appPath Application root path.
   */
  public constructor(
    appPath: string,
    public overwrites?: Partial<ServaConfig>,
  ) {
    this.appPath = path.resolve(appPath);
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
    if (this.server) {
      console.log("App already started.");
      return;
    }

    await this.mount();

    const options: http.HTTPOptions = {
      port: this.config.port,
    };

    if (this.config.hostname) {
      options.hostname = this.config.hostname;
    }

    // @ts-expect-error
    this.server = http.serve(options);

    console.log(
      `App started, ${
        options.hostname ? options.hostname : ""
      }:${options.port}`,
    );

    for await (const request of this.server) {
      this.handleRequest(request);
    }
  }

  /**
   * Stops the server if running.
   * 
   * @public
   * @returns {void}
   */
  public stop() {
    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Mounts the application to the `appPath`.
   * 
   * @params {boolean} [remount] Fource app to remount.
   * @returns {Promise<void>}
   */
  async mount(remount: boolean = false): Promise<void> {
    if (!remount && this.routes.size > 0) {
      return;
    }

    const routesPath = this.path(ROUTES_DIR);

    // /////////////////////////////////////////////////////////////////////////
    // Config

    try {
      const configFilePath = this.path("serva.config.json");
      const lstats = await Deno.lstat(configFilePath);
      if (!lstats.isFile) {
        throw new Error();
      }

      // @ts-expect-error
      this.config = Object.assign({}, DEFAULT_CONFIG);

      const config = await fs.readJson(configFilePath) as object;
      [config, this.overwrites].forEach((object) => {
        if (!object) {
          return;
        }

        for (const [key, value] of Object.entries(object)) {
          switch (key) {
            case "port":
            case "hostname":
            case "extension":
            case "methods":
              // @ts-ignore
              this.config[key] = value;
              break;

            default:
              throw new Error(`Invalid config for: \`${key}\`.`);
          }
        }
      });
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        console.log("No serva.config.json found, using defaults.");
      } else {
        throw err;
      }
    }

    // /////////////////////////////////////////////////////////////////////////
    // Routes

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

    for await (const entry of fs.walk(routesPath, { includeDirs: false })) {
      // ignore any non-typescript files
      // todo: support for javascript
      if (!entry.name.endsWith(this.config.extension)) {
        continue;
      }

      const relativeEntryPath = path.relative(routesPath, entry.path);
      const method = routeMethod(relativeEntryPath, this.config);
      const urlPath = routePath(relativeEntryPath, this.config); // route information
      const route = createRoute(
        method,
        urlPath,
        entry.path,
      );

      // register route
      let callback: unknown;
      try {
        let filePath = `file://${entry.path}`;
        if (remount) {
          filePath += "#" + Math.random();
        }

        ({ default: callback } = await import(filePath));
        if (typeof callback !== "function") {
          throw new TypeError(
            `${route.filePath} default export is not a callback.`,
          );
        }
      } catch (err) {
        console.log("Error in file:", entry.path, err);
        continue;
      }

      // check if the export was a factory
      // @ts-ignore https://github.com/Microsoft/TypeScript/issues/1863
      const factory = callback[Symbol.for("serva_factory")];
      let hooks: OnRequestCallback[] = [];
      if (factory) {
        switch (factory) {
          case "route":
            [hooks, callback] = (callback as RouteFactory)(route);
            break;

          default:
            throw new Error(`Factory (${factory}) not implemented`);
        }
      }

      routes.push(
        [
          route.method,
          [
            route,
            hooks.concat(routeToRequestCallback(callback as RouteCallback)),
          ],
        ],
      );
    }

    // sort and set routes
    routes.sort(sortRoutes).forEach(([method, entry]) => {
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
    let callbacks: OnRequestCallback[] = [];
    const { pathname } = new URL(req.url, "https://serva.land");

    const possibleMethods = [req.method, "*"];
    if (req.method === "HEAD") {
      possibleMethods.splice(0, 1, "GET");
    }

    possibleMethods.some((m) => {
      const entries = this.routes.get(m);
      if (entries) {
        return entries.some(([r, cbs]) => {
          if (r.regexp.test(pathname)) {
            route = r;
            callbacks = cbs;
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
    await dispatch(callbacks, request);

    // if nobody has responded, send the current request's response
    if (request.httpRequest.w.usedBufferBytes === 0) {
      const { response } = request;

      // detect json response
      const tryJSON = !validHttpResponseBody(response.body);
      if (tryJSON) {
        response.body = JSON.stringify(response.body);
        const headers = response.headers || (response.headers = new Headers());

        // set the
        headers.set("content-type", "application/json; charset=utf-8");
      }

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
 * @param {string} filePath
 * @param {ServaConfig} config
 * @returns {string}
 */
function routePath(filePath: string, config: ServaConfig): string {
  let name = path.basename(filePath, config.extension);
  const matched = name.match(
    new RegExp(`.*(?=\.(${config.methods.join("|")})$)`, "i"),
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
 * @param {string} filePath
 * @param {ServaConfig} config
 * @returns {string}
 */
function routeMethod(filePath: string, config: ServaConfig): string {
  const name = path.basename(filePath, config.extension);
  const matched = name.match(
    new RegExp(`.*(?=\.(${config.methods.join("|")})$)`, "i"),
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

/**
 * The hooks dispatcher.
 *
 * @param {OnRequestCallback[]} callbacks
 * @param {ServaRequest} request
 * @returns {Promise<any>}
 */
function dispatch(
  callbacks: OnRequestCallback[],
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
 * Transforms a route callback to a request hook callback.
 *
 * @param {RouteCallback} callback
 * @returns {OnRequestCallback}
 */
function routeToRequestCallback(callback: RouteCallback): OnRequestCallback {
  return async function (request, next) {
    const body = callback(request);
    if (body !== undefined) {
      request.response.body = body;
    }
    return next();
  };
}

function validHttpResponseBody(body: any): boolean {
  switch (typeof body) {
    case "undefined":
    case "string":
      return true;

    case "object":
      return body &&
        (body instanceof Uint8Array || typeof body.read === "function");

    default:
      return false;
  }
}
