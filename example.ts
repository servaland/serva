import { Serva } from "./mod.ts";

const app = new Serva();

app.use(["GET"], "/*", async (__, next) => {
  console.log("entered");

  await next();

  console.log("exited");
});

app.route(["GET"], "/", () => "Hello, World!");
app.route(
  ["GET"],
  "/hello/[name]",
  (__, name) => `Hello, ${name}!`,
);

app.serve();
