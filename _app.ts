import { flags, http, path, pathToRegexp } from "./deps.ts";
import { fileMethods, readDir, Route } from "./_routes.ts";

interface Options {
  port: number;
  hostname: string;
  js: boolean;
}

const defaultFlags: Options = {
  port: 4500,
  hostname: "0.0.0.0",
  js: false,
};

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
  const routes = await readDir(routesPath, fileExtension);

  const groupedRoutes: { [method: string]: Route[] } = fileMethods.reduce(
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

  console.log(groupedRoutes);

  const server = http.serve({
    port,
    hostname,
  });

  const listen = async () => {
    // listen...
    for await (const request of server) {
      // const url = new URL(request.url, "http://serva.land");
      // let match: pathToRegexp.Match | undefined;
      // const availableRoutes = groupedRoutes[request.method.toLowerCase()];
      // const route = availableRoutes.find((entry) => {
      //   match = entry.match(url.pathname);
      //   return match !== false;
      // });
      // if (route && match) {
      //   const { params } = match;
      //   const result = route.handler(request, params);
      //   // did the handler respond?
      //   if (request.w.usedBufferBytes === 0) {
      //     Promise.resolve(result).then((body) => {
      //       const response: http.Response = {};
      //       if (typeof response !== "undefined") {
      //         response.body = body as http.Response["body"];
      //       }
      //       // respond
      //       request.respond(response);
      //     });
      //   }
      // } else {
      //   request.respond({
      //     status: 404,
      //     body: `${request.url} not found.`,
      //   });
      // }
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
