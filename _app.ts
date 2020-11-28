import { flags, fs, http, path } from "./deps.ts";

interface Options {
  port: number;
  hostname: string;
  js: boolean;
}

export type RequestHandler = (
  request: http.ServerRequest
) => Promise<void> | void;

interface Route {
  path: string;
  handler: RequestHandler;
}

const defaultFlags: Options = {
  port: 4500,
  hostname: "0.0.0.0",
  js: false,
};

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

    let basename = path.basename(entry.path, fileExtension);
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
    const route = routes.find((route) => route.path === request.url);
    if (route) {
      route.handler(request);
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
