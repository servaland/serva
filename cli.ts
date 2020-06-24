import { parse, Args } from "https://deno.land/std@0.57.0/flags/mod.ts";
import App from "./app.ts";

main(Deno.args);

function main(argv: string[]) {
  const flags = parse(Deno.args);

  switch (flags._[0]) {
    case "dev":
      develop(flags);
      break;
  }
}

async function develop(flags: Args) {
  let timer: number;

  const app = new App(flags._[1] as string || ".");
  app.start();

  for await (const event of Deno.watchFs(app.path("routes"))) {
    switch (event.kind) {
      case "create":
      case "modify":
      case "remove":
        remount();
    }
  }

  function remount() {
    clearTimeout(timer);
    timer = setTimeout(() => app.remount(), 50);
  }
}
