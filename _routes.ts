import { http, path, pathToRegexp } from "./deps.ts";

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

const fileMethods: Method[] = [];
for (const method in Method) {
  fileMethods.push(method as Method);
}
const fileMethodPattern = new RegExp(`(\\.(${fileMethods.join("|")}))$`, "i");

export interface Route {
  file: string;
  path: string;
  methods: Method[];
  match: pathToRegexp.MatchFunction;
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
  const match = pathToRegexp.match(convertPath(path_));

  return {
    file,
    methods,
    path: path_,
    match,
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
  let path_ =
    "/" + path.dirname(file).replaceAll(new RegExp(path.SEP_PATTERN, "g"), "/");

  const base = extractBase(file, ext);
  if (base) {
    path_ += `/${base}`;
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

const paramsPattern = /(\[{1,2})(\.{3})?([a-z][a-z0-9\-_.]*)(\]{1,2})/gi;

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
