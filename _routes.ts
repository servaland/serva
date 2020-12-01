import { fs, http, path, pathToRegexp } from "./deps.ts";

type ResponseBody = http.Response["body"] | void;

export type RequestHandler<P extends object = object> = (
  request: http.ServerRequest,
  params: P
) => Promise<ResponseBody> | ResponseBody;

export enum Method {
  DELETE = "DELETE",
  GET = "GET",
  PATCH = "PATCH",
  POST = "POST",
  PUT = "PUT",
}

export const fileMethods: Method[] = [];
for (const method in Method) {
  fileMethods.push(method as Method);
}
const fileMethodPattern = new RegExp(`(\\.(${fileMethods.join("|")}))$`, "i");

export interface Route {
  file: string;
  path: string;
  methods: Method[];
  match: pathToRegexp.MatchFunction;
  // url: pathToRegexp.PathFunction;
}

/**
 * Read a directory and create routes for its contents.
 *
 * @example
 *   await readDir("/opt/app/routes", ".ts");
 *   // => [{}, {}, {}]
 *
 * @param {string} dir
 * @param {string} ext
 * @return {Promise<Route[]>}
 */
export async function readDir(dir: string, ext: string): Promise<Route[]> {
  const routes: Route[] = [];
  for await (const route of walkDir(dir, ext)) {
    routes.push(route);
  }

  routes.sort(sort);

  return routes;
}

/**
 * Async generator that walks a directory and creates routes from each entry.
 *
 * @example
 *   for await (const route of walkDir("/opt/app/routes")) {
 *     // register route
 *   }
 *
 * @param {string} dir
 * @param {string} ext
 * @returns {AsyncIterableIterator<Route>}
 */
async function* walkDir(
  dir: string,
  ext: string
): AsyncIterableIterator<Route> {
  for await (const entry of fs.walk(dir, {
    includeDirs: false,
    exts: [ext],
  })) {
    yield fromFile(entry.path, dir, ext);
  }
}

/**
 * Creates a route from a file.
 *
 * @example
 *   fromFile("/opt/app/routes/index.get.ts", "/opt/app/routes");
 *   // => { file: "...", path: "/", methods: ["GET"] }
 *
 * @private
 * @param {string} file
 * @param {string} base The base/routes path.
 * @param {string} ext
 * @returns {Route}
 */
function fromFile(
  file: string,
  base: string = "",
  ext: string = path.extname(file)
): Route {
  const [path_, methods] = extractPathMethods(path.relative(base, file), ext);
  const regexpPath = convertPath(path_);

  return {
    file,
    methods,
    path: path_,
    match: pathToRegexp.match(regexpPath),
    // url: pathToRegexp.compile(regexpPath, { encode: encodeURIComponent }),
  };
}

/**
 * Extracts the path and methods from a file.
 *
 * @example
 *   extractPath("/post/[id].get.ts");
 *   // => ["/posts/[id]", ["GET"]]
 *
 * @private
 * @param {string} file
 * @param {string} ext
 * @returns {[string, Methods[]]}
 */
function extractPathMethods(file: string, ext: string): [string, Method[]] {
  const dirname = path.dirname(file);
  let path_ =
    "/" +
    (dirname !== "." ? path.dirname(file) : "").replaceAll(
      new RegExp(path.SEP_PATTERN, "g"),
      "/"
    );

  const base = extractBase(file, ext);
  if (base) {
    path_ += `${path_ !== "/" ? "/" : ""}${base}`;
  }

  return [path_, extractMethods(path.basename(file, ext))];
}

/**
 * Extracts the base from a file.
 *
 * @example
 *   extractBase("/user.post.ts");
 *   // => "/user"
 *
 *   extractBase("/index.get.ts");
 *   // => "/"
 *
 * @private
 * @param {string} file
 * @param {string} ext
 * @return {string}
 */
function extractBase(file: string, ext: string = ".ts"): string {
  const basename = path.basename(file, ext).replace(fileMethodPattern, "");
  return basename !== "index" ? basename : "";
}

/**
 * Extracts the methods from a file.
 *
 * @example
 *   extractMethods("index.get.ts");
 *   // => ["GET"]
 *
 *   extractMethods("index.ts");
 *   // => ["DELETE", "GET", "PATCH", "POST", "PUT"]
 *
 * @private
 * @param {string} file
 * @return {Method[]}
 */
function extractMethods(file: string): Method[] {
  const match = file.match(fileMethodPattern);
  if (match) {
    return [match[2].toUpperCase() as Method];
  }
  return fileMethods.concat();
}

const paramNamePatternString = "[a-z][a-z0-9_\\-.]*";
const paramsPattern = new RegExp(
  `(\\[{1,2})(\\.{3})?(${paramNamePatternString})(\\]{1,2})`,
  "gi"
);

/**
 * Converts a file path into a path-to-regexp path.
 *
 * @example
 *   convertPath("/posts/[id]");
 *   // => "/posts/:id"
 *
 * @private
 * @param {string} routePath
 * @returns {string}
 */
function convertPath(routePath: string): string {
  let path_ = routePath;

  // find all the params
  const params: string[] = [];
  for (const match of routePath.matchAll(paramsPattern)) {
    const [_, open, spread, name, close] = match;

    if (open.length !== close.length) {
      throw new Error(`param mis-matching bracket: ${match[0]}`);
    }

    params.push(
      asParam(name, open.length === 2, typeof spread !== "undefined")
    );
  }

  // swap the params format to path-to-regexp format
  if (params.length) {
    // use null char as placholders
    path_ = path_.replaceAll(paramsPattern, "\0");
    params.forEach((param) => {
      path_ = path_.replace("\0", param);
    });
  }

  return path_;
}

/**
 * Constructs a path-to-regexp param name.
 *
 * @example
 *   paramName("foo");
 *   // => ":foo"
 *
 * @see {@link https://github.com/pillarjs/path-to-regexp/blob/v6.2.0/Readme.md}
 *
 * @private
 * @param {string} name
 * @param {boolean} optional
 * @param {boolean} spread
 * @returns {string}
 */
function asParam(
  name: string,
  optional: boolean = false,
  spread: boolean = false
): string {
  let modifier = "";

  if (spread) {
    modifier = optional ? "*" : "+";
  } else if (optional) {
    modifier = "?";
  }

  return `:${name}${modifier}`;
}

/**
 * A very complex sorting algorithm for routes.
 *
 * @todo document this
 *
 * @private
 * @param {Route} a
 * @param {Route} b
 * @returns {number}
 */
function sort(a: Route, b: Route): number {
  const { path: pathA, methods: methodsA } = a;
  const { path: pathB, methods: methodsB } = b;

  // same paths, check the methods
  if (pathA === pathB) {
    return methodsA.length - methodsB.length;
  }

  // paths into segments
  const segmentsA = pathA.split("/").filter(Boolean);
  const segmentsB = pathB.split("/").filter(Boolean);

  // sort paths with more segments higher because they have a more defined path
  if (segmentsA.length !== segmentsB.length) {
    return segmentsA.length - segmentsB.length;
  }

  // iterate over ALL available segments for the path with the most "winners".
  for (
    let i = 0, l = Math.max(segmentsA.length, segmentsB.length);
    i < l;
    ++i
  ) {
    const segA = segmentsA[i];
    const segB = segmentsB[i];

    // equal segments, check next
    if (segA === segB) {
      continue;
    }

    // find [params]
    const matchA = segA.match(paramsPattern);
    const matchB = segB.match(paramsPattern);

    // no params, paths will never cross so we fallback
    if (matchA === matchB) {
      break;
    } else if (!matchA || !matchB) {
      // or only one matched, so the other is a static and wins
      return matchA ? 1 : -1;
    }

    // substitute params with placeholders
    const markerA = paramMarker(segA);
    const markerB = paramMarker(segB);

    // matching placeholders? this is possible if the developer does the
    // following:
    //     /[foo]
    //     /[bar]
    if (markerA === markerB) {
      // theres nothing much we can do here but continue
      // todo: warn the developer of conflicting routes?
      continue;
    }

    // iterate each char and find the "winner"
    for (let j = 0, m = Math.min(markerA.length, markerB.length); j < m; ++j) {
      const codeA = markerA.charCodeAt(j);
      const codeB = markerB.charCodeAt(j);

      // same character, next char
      if (codeA === codeB) {
        continue;
      }

      // the longer segment wins
      const nanA = Number.isNaN(codeA);
      if (nanA || Number.isNaN(codeB)) {
        return nanA ? 1 : -1;
      }

      // if a single placeholder then its highest code wins as higher codes are
      // statics
      if ((codeA < 4 && codeB > 4) || (codeA > 4 && codeB < 4)) {
        return codeB - codeA;
      }

      // lowest placeholder wins
      return codeA - codeB;
    }
  }

  return 0;
}

/**
 * Puts null character markers in replace of params. A utility function for
 * sorting routes.
 *
 * @param {string} file
 * @returns {string}
 */
function paramMarker(file: string): string {
  return file
    .replace(
      new RegExp(`\\[{2}\\.{3}${paramNamePatternString}\\]{2}`, "ig"),
      "\u0003"
    )
    .replace(
      new RegExp(`\\[{2}${paramNamePatternString}\\]{2}`, "ig"),
      "\u0002"
    )
    .replace(
      new RegExp(`\\[\\.{3}${paramNamePatternString}\\]`, "ig"),
      "\u0001"
    )
    .replace(new RegExp(`\\[${paramNamePatternString}\\]`, "ig"), "\u0000");
}
