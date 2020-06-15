import { Serva, RequestMethod } from "./mod.ts";

const app = new Serva();

app.use([RequestMethod.GET], "/*", async (__, next) => {
  console.log("entered");

  await next();

  console.log("exited");
});

app.route([RequestMethod.GET], "/", () => "Hello, World!");
app.route(
  [RequestMethod.GET],
  "/hello/[name]",
  (__, name) => `Hello, ${name}!`,
);

app.serve({ port: 3333 });
