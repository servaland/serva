import { delay } from "https://deno.land/std@0.57.0/async/delay.ts";
import {
  assertEquals,
  assertThrows,
  assertThrowsAsync,
} from "https://deno.land/std@0.57.0/testing/asserts.ts";
import App from "./_app.ts";
import { path } from "./deps.ts";

const cwd = path.dirname(new URL(import.meta.url).pathname);

Deno.test("appPath", () => {
  {
    const app = new App(".");
    assertEquals(app.path(), cwd);
  }
  {
    const app = new App("example");
    assertEquals(app.path(), path.join(cwd, "example"));
  }
  {
    const app = new App("/opt/app");
    assertEquals(app.path(), "/opt/app");
    assertEquals(app.path("routes"), "/opt/app/routes");
    assertEquals(app.path("routes/.."), "/opt/app");
    assertEquals(app.path("routes", "profile"), "/opt/app/routes/profile");
  }
  {
    const app = new App("/opt/app");
    assertEquals(app.path("/tmp"), "/tmp");
  }
});

Deno.test("mount", async () => {
  {
    assertThrowsAsync(
      async () => {
        const app = new App(".");
        await app.mount();
      },
      undefined,
      "routes not found",
    );
  }
  {
    const app = new App("./example");
    await app.mount();

    assertEquals(app.config, {
      port: 4500,
      extension: ".ts",
      methods: ["get", "post", "put", "delete", "patch"],
    });
  }
});

Deno.test("start", async () => {
  const app = new App("./example", { port: 4400 });
  app.start();

  // allow the app to start
  await delay(100);

  // @ts-expect-error
  const rid = app.server!.listener.rid;
  const resources = Deno.resources();

  assertEquals(resources[rid], "tcpListener");

  app.stop();
});

Deno.test("main", async () => {
  {
    assertThrows(() => {
      App.main(["fail"]);
    });
  }
  {
    const app = App.main(["start", "./example"]);

    // allow the app to start
    await delay(100);

    // @ts-expect-error
    const rid = app.server!.listener.rid;
    const resources = Deno.resources();

    assertEquals(resources[rid], "tcpListener");

    app.stop();
  }
});
