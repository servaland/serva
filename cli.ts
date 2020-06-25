import { parse, Args } from "https://deno.land/std@0.57.0/flags/mod.ts";
import App from "./app.ts";

if (import.meta.main) {
  main(Deno.args);
}

export default function main(argv: string[]) {
  const flags = parse(Deno.args);

  switch (flags._[0]) {
    case "dev":
      develop(flags);
      break;

    case "start":
      start(flags);
      break;
  }
}

async function develop(flags: Args) {
  let timer: number;
  const app = createApp(flags);

  app.start();

  for await (const event of Deno.watchFs(app.path("routes"))) {
    switch (event.kind) {
      case "create":
      case "modify":
      case "remove":
        remount();
    }
  }

  // debounce the remount
  function remount() {
    clearTimeout(timer);
    timer = setTimeout(() => app.remount(), 50);
  }
}

function start(flags: Args) {
  const app = createApp(flags);

  app.start();
}

function createApp(flags: Args): App {
  return new App(flags._[1] as string || ".");
}
