import {
  resolve,
  isAbsolute,
  readJson,
  join,
  walk,
  dirname,
  relative,
  exists,
  basename,
} from "./deps.ts";
import { warn } from "./_logger.ts";
import { RequestMethod } from "./_route.ts";
import {
  Serva,
  ServaOptions,
  MiddlewareCallback,
  EndpointCallback,
} from "./serva.ts";

export const configFileName = "serva.config.json";

type ServaConfig = ServaOptions & {
  fileExtension?: string;
};

const defaultConfig: ServaConfig = {
  fileExtension: ".ts",
};

export async function mount(directory: string = Deno.cwd()): Promise<Serva> {
  if (!isAbsolute(directory)) {
    directory = resolve(directory);
  }

  // load the config file
  const configPath = join(directory, configFileName);
  const config: ServaConfig = Object.create(defaultConfig);

  if (await exists(configPath)) {
    Object.assign(config, await readJson(configPath));
  }

  const app = new Serva({
    hostname: config.hostname,
    port: config.port,
  });

  // read the directory structure
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isDirectory) {
      switch (entry.name) {
        case "routes":
          for await (
            const route of readRoutes(join(directory, entry.name), config)
          ) {
            const callback = route.factory(
              createScopedApp(app, route.methods, route.path),
            );

            app.route(route.methods, route.path, callback);
          }
          break;
      }
    }
  }

  return app;
}

interface RouteEntry {
  path: string;
  methods: RequestMethod[];
  factory: (app: Serva) => EndpointCallback;
}

async function* readRoutes(
  directory: string,
  config: ServaConfig,
): AsyncIterable<RouteEntry> {
  const entries: RouteEntry[] = [];
  for await (const entry of walk(directory)) {
    // skip directories and non-matching extension files
    if (entry.isDirectory || !entry.name.endsWith(config.fileExtension!)) {
      continue;
    }

    let name = basename(entry.name, config.fileExtension);
    let method = "get";

    const matched = name.match(
      /.*(?=\.(get|post|put|options|delete|patch)$)/i,
    );

    if (matched) {
      [name, method] = matched;
    }

    if (name === "index") {
      name = "";
    }

    let base = dirname(relative(directory, entry.path));

    if (base === ".") {
      base = "";
    }

    const module = await import(entry.path);
    if (typeof module.default !== "function") {
      warn(`invalid export file://${entry.path}`);
      continue;
    }

    yield {
      path: "/" + (base ? join(base, name) : name),
      methods: [method.toUpperCase() as RequestMethod],
      factory: module.default,
    };
  }
}

function createScopedApp(
  app: Serva,
  methods: RequestMethod[],
  path: string,
): Serva {
  return new Proxy(app, {
    get(target, property, receiver) {
      switch (property) {
        case "use":
          return function use(callback: MiddlewareCallback) {
            return target.use(methods, path, callback);
          };

        case "route":
          // blocked methods/props
          return undefined;

        default:
          return Reflect.get(target, property, receiver);
      }
    },
  });
}
