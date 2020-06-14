import { Serva, RequestMethod } from "./mod.ts";

const app = new Serva();

app.use([RequestMethod.GET], "/", async (_, next) => {
  console.log("entered");

  await next();

  console.log("exited");
});

app.route([RequestMethod.GET], "/", () => "Hello, World!");

app.serve({ port: 3333 });
