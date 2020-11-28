import { flags, fs, http, path } from "./deps.ts";

interface Options {
  port: number;
  hostname: string;
  js: boolean;
}

type ResponseBody = http.Response["body"] | void;

export type RequestHandler = (
  request: http.ServerRequest
) => Promise<ResponseBody> | ResponseBody;

interface Route {
  path: string;
  methods: string[];
  handler: RequestHandler;
}

const defaultFlags: Options = {
  port: 4500,
  hostname: "0.0.0.0",
  js: false,
};

const filenameMethods = ["get", "post", "delete", "put", "patch"];
const filenameMethodPattern = new RegExp(
  `(\\.(${filenameMethods.join("|")}))$`
);

export async function main(argv: string[]) {
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

  console.log(rest);

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
    let routePath = "/" + path.relative(routesPath, path.dirname(entry.path));
    let methods: string[] = filenameMethods;

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

    routes.push({
      methods,
      path: routePath,
      handler: handler as RequestHandler,
    });
  }

  const server = http.serve({
    port,
    hostname,
  });

  // listen...
  for await (const request of server) {
    const route = routes.find(
      (route) =>
        route.path === request.url &&
        route.methods.includes(request.method.toLowerCase())
    );

    if (route) {
      const result = route.handler(request);
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
}

function toAbsolutePath(givenPath: string = "."): string {
  if (path.isAbsolute(givenPath)) {
    return givenPath;
  }

  return path.resolve(Deno.cwd(), givenPath);
}
