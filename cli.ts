import {
  colors,
  parse,
  isAbsolute,
  resolve,
  emptyDir,
  join,
} from "./deps.ts";
import { error, info } from "./_logger.ts";
import { mount, configFileName } from "./mount.ts";

const VERSION = "0.0.0-alpha";
const HEADER = `🦎 ${colors.bold("Serva")} ${colors.dim(`(${VERSION})`)}
Web servers made simple.
https://serva.land`;

const flags = parse(Deno.args);
const commands = flags._;

const needHelpWith = flags.help || flags.h;
const needsHelp = Boolean(needHelpWith);

switch (commands[0]) {
  case "init":
    if (needsHelp) {
      help("init");
    } else {
      init();
    }
    break;

  case "start":
    if (needsHelp) {
      help("start");
    } else {
      start();
    }
    break;

  default:
    if (flags.version || flags.V) {
      version();
    } else {
      help(needHelpWith);
    }

    break;
}

function version() {
  console.log(VERSION);
}

async function init() {
  const force = flags.force || flags.f;

  let directory = commands[1] as string || Deno.cwd();
  if (!isAbsolute(directory)) {
    directory = resolve(directory);
  }

  const file = `file://${directory}`;
  const contents: Deno.DirEntry[] = [];

  try {
    const dirInfo = await Deno.lstat(directory);

    if (!dirInfo.isDirectory) {
      error(`${file} is not a directory.`);
      Deno.exit(2);
    }

    for await (const entry of Deno.readDir(directory)) {
      contents.push(entry);
    }

    if (contents.length && !force) {
      error(`${file} is not empty, run with \`--force\` to overwite.`);
      Deno.exit(3);
    }
  } catch (err) {
    await emptyDir(directory);
    info(`file://${directory} directory created.`);
  }

  const e = new TextEncoder();
  let servaModule = `https://deno.land/x/serva@${VERSION}/mod.ts`;

  // serva.config.json
  const configFile = join(directory, configFileName);
  if (contents.find((entry) => entry.name === configFileName)) {
    info(`file://${configFile} already exists, skipping.`);
  } else {
    await Deno.writeFile(
      configFile,
      e.encode(`{
  "hostname": "0.0.0.0",
  "port": 3333
}
    `),
    );
    info(`file://${configFile} file created.`);
  }

  // deps.ts
  let skippedDeps = false;
  const depsFile = join(directory, "deps.ts");
  if (contents.find((entry) => entry.name === "deps.ts")) {
    skippedDeps = true;
    info(`file://${depsFile} already exists, skipping.`);
  } else {
    await Deno.writeFile(
      depsFile,
      e.encode(`export * from "${servaModule}";\n`),
    );
    info(`file://${depsFile} file created.`);
    servaModule = "../deps.ts";
  }

  // routes/
  const routesDir = join(directory, "routes");
  const routesInfo = contents.find((entry) =>
    entry.isDirectory && entry.name === "routes"
  );
  if (!routesInfo) {
    await emptyDir(routesDir);
    info(`file://${routesDir} directory created.`);
  }

  // routes/index.ts
  const indexFile = join(routesDir, "index.ts");
  try {
    const indexInfo = await Deno.lstat(indexFile);
    if (indexInfo.isFile) {
      info(`file://${indexFile} already exists, skipping.`);
    }
  } catch (err) {
    await Deno.writeFile(
      indexFile,
      e.encode(
        servaModule.startsWith(".")
          ? `import { Serva, RequestContext } from "../deps.ts";

export default (app: Serva) => (context: RequestContext) => "Hello, World!";\n`
          : `import {
  Serva,
  RequestContext,
} from "${servaModule}";

export default (app: Serva) => (context: RequestContext) => "Welcome to Serva";\n`,
      ),
    );
    info(`file://${indexFile} file created.`);
  }
}

async function start() {
  const app = await mount(commands[1] as any);
  app.serve();
}

function help(command?: string) {
  switch (command) {
    case "init":
      console.log(`${HEADER}

Initialize directory.

PERMISSIONS
    --allow-read
    --allow-write

USAGE
    serva init [OPTIONS] [PATH=.]

OPTIONS
    -f, --force    Forces directory initialization
    -h, --help     Prints help information`);
      break;

    case "start":
      console.log(`${HEADER}

Start web server.

PERMISSIONS
    --allow-read
    --allow-net

USAGE
    serva start [OPTIONS] [PATH=.]

OPTIONS
    -h, --help     Prints help information`);
      break;

    default:
      console.log(`${HEADER}

Install on machine:
  deno install https://deno.land/x/serva@${VERSION}/cli.ts

Run command:
  deno run https://deno.land/x/serva@${VERSION}/cli.ts [OPTIONS] [COMMAND]

USAGE
    serva [OPTIONS] [COMMAND]

OPTIONS
    -h, --help       Prints help information
    -V, --version    Prints version information

COMMANDS
    init     Initialize directory
    start    Start web server

\`serva <COMMAND> --help \` to print help information for a command.`);
      break;
  }
}
