import { flags, fs, http, path, pathToRegexp } from "./deps.ts";

interface Options {
  port: number;
  hostname: string;
  js: boolean;
}

type ResponseBody = http.Response["body"] | void;

export type RequestHandler<P extends object = object> = (
  request: http.ServerRequest,
  params: P
) => Promise<ResponseBody> | ResponseBody;

interface Route {
  file: string;
  path: string;
  methods: string[];
  match: pathToRegexp.MatchFunction;
  handler: RequestHandler;
}

const defaultFlags: Options = {
  port: 4500,
  hostname: "0.0.0.0",
  js: false,
};

const filenameMethods = ["delete", "get", "patch", "post", "put"];
const filenameMethodPattern = new RegExp(
  `(\\.(${filenameMethods.join("|")}))$`
);

export async function main(
  argv: string[]
): Promise<[http.Server, Promise<void>]> {
  const { _: args, host: _, ...rest } = flags.parse(argv, {
    boolean: ["js"],
    alias: {
      host: "hostname",
    },
    default: defaultFlags as {},
    unknown(_, flag) {
      if (typeof flag === "undefined") {
        return true;
      }
      return Object.keys(defaultFlags).includes(flag);
    },
  });

  const { hostname, port, js } = rest as Options;
  const appPath = toAbsolutePath(args[0] as string | undefined);

  const fileExtension = js ? ".js" : ".ts";

  const routesPath = path.join(appPath, "routes");
  const routesReader = fs.walk(routesPath, {
    includeDirs: false,
    exts: [fileExtension],
  });

  // read routes directory
  const routes: Route[] = [];
  for await (const entry of routesReader) {
    const file = path.relative(appPath, entry.path);
    let routePath = "/" + path.relative(routesPath, path.dirname(entry.path));
    let methods: string[] = filenameMethods;

    routePath = routePath.replace(new RegExp(path.SEP_PATTERN, "g"), "/");

    let basename = path.basename(entry.path, fileExtension);

    // "/index.get" => "/index"
    const matchedMethod = basename.match(filenameMethodPattern);
    if (matchedMethod !== null) {
      methods = [matchedMethod[2]];
      basename = basename.replace(filenameMethodPattern, "");
    }

    // "/index" => "/"
    if (basename !== "index") {
      const slash = routePath.substr(-1) !== "/" ? "/" : "";
      routePath += slash + basename;
    }

    // require route the handler
    const handler: unknown = await import(`file://${entry.path}`).then(
      (mod) => mod.default
    );

    if (typeof handler !== "function") {
      throw new Error(`Invalid request handler: ${entry.path}`);
    }

    // check for conflicts
    routes.forEach((route) => {
      if (
        route.path === routePath &&
        methods.join(",") === filenameMethods.join(",")
      ) {
        throw Error(`route conflict: "${file}" with "${route.file}".`);
      }
    });

    routes.push({
      file,
      methods,
      path: routePath,
      match: pathToRegexp.match(pathToRegexpPath(routePath)),
      handler: handler as RequestHandler,
    });
  }

  routes.sort(sortRoutes);

  const groupedRoutes: { [method: string]: Route[] } = filenameMethods.reduce(
    (group, method) => ({
      ...group,
      [method]: [],
    }),
    {}
  );

  // group the routes by their method
  routes.forEach((route) => {
    route.methods.forEach((method) => {
      groupedRoutes[method].push(route);
    });
  });

  const server = http.serve({
    port,
    hostname,
  });

  const listen = async () => {
    // listen...
    for await (const request of server) {
      const url = new URL(request.url, "http://serva.land");
      let match: pathToRegexp.Match | undefined;
      const availableRoutes = groupedRoutes[request.method.toLowerCase()];
      const route = availableRoutes.find((entry) => {
        match = entry.match(url.pathname);
        return match !== false;
      });

      if (route && match) {
        const { params } = match;
        const result = route.handler(request, params);
        // did the handler respond?
        if (request.w.usedBufferBytes === 0) {
          Promise.resolve(result).then((body) => {
            const response: http.Response = {};
            if (typeof response !== "undefined") {
              response.body = body as http.Response["body"];
            }
            // respond
            request.respond(response);
          });
        }
      } else {
        request.respond({
          status: 404,
          body: `${request.url} not found.`,
        });
      }
    }
  };

  return [server, listen()];
}

function toAbsolutePath(givenPath: string = "."): string {
  if (path.isAbsolute(givenPath)) {
    return givenPath;
  }

  return path.resolve(Deno.cwd(), givenPath);
}

const SEG_PARAM = "\u0000";
const SEG_PARAM_SPREAD = "\u0001";
const SEG_OPTIONAL = "\u0002";
const SEG_OPTIONAL_SPREAD = "\u0003";

const PARAM_NAME_PATTERN = "[a-z][a-z0-9_\\-.]*";

function pathToPlaceholder(givenPath: string): string {
  return givenPath
    .replace(
      new RegExp(`\\[{2}\\.{3}${PARAM_NAME_PATTERN}\\]{2}`, "ig"),
      SEG_OPTIONAL_SPREAD
    )
    .replace(
      new RegExp(`\\[{2}${PARAM_NAME_PATTERN}\\]{2}`, "ig"),
      SEG_OPTIONAL
    )
    .replace(
      new RegExp(`\\[\\.{3}${PARAM_NAME_PATTERN}\\]`, "ig"),
      SEG_PARAM_SPREAD
    )
    .replace(new RegExp(`\\[${PARAM_NAME_PATTERN}\\]`, "ig"), SEG_PARAM);
}

function sortRoutes(a: Route, b: Route): number {
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
    const matchA = segA.match(/\[{1,2}(\.{3})?[a-z][a-z0-9\-_.]*\]{1,2}/g);
    const matchB = segB.match(/\[{1,2}(\.{3})?[a-z][a-z0-9\-_.]*\]{1,2}/g);

    // no params, paths will never cross so we fallback
    if (matchA === matchB) {
      break;
    } else if (!matchA || !matchB) {
      // or only one matched, so the other is a static and wins
      return matchA ? 1 : -1;
    }

    // substitute params with placeholders
    const placeholderA = pathToPlaceholder(segA);
    const placeholderB = pathToPlaceholder(segB);

    // matching placeholders? this is possible if the developer does the
    // following:
    //     /[foo]
    //     /[bar]
    if (placeholderA === placeholderB) {
      // theres nothing much we can do here but continue
      // todo: warn the developer of conflicting routes?
      continue;
    }

    // iterate each char and find the "winner"
    for (
      let j = 0, m = Math.min(placeholderA.length, placeholderB.length);
      j < m;
      ++j
    ) {
      const codeA = placeholderA.charCodeAt(j);
      const codeB = placeholderB.charCodeAt(j);

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

function pathToRegexpPath(givenPath: string): string {
  let regexpPath = "";
  let i = givenPath.indexOf("[");

  if (i === -1) {
    return givenPath;
  }

  if (i >= 0) {
    regexpPath = givenPath.substring(0, i);

    while (i < givenPath.length) {
      const char = givenPath.charAt(i);

      if (char === "[") {
        const optional = givenPath.charAt(i + 1) === "[";
        const ending = i + givenPath.slice(i).indexOf("]");
        let name = givenPath.substring(i + (optional ? 2 : 1), ending);

        const spread = name.startsWith("...");
        if (spread) {
          name = name.substr(3);
        }

        regexpPath += `:${name}`;

        // modifiers
        if (spread) {
          regexpPath += optional ? "*" : "+";
        } else if (optional) {
          regexpPath += "?";
        }

        i = ending + (optional ? 2 : 1);
      } else {
        regexpPath += char;
        // next char
        i++;
      }
    }
  } else {
    regexpPath = givenPath;
  }

  return regexpPath;
}
