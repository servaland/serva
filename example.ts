import { App, RequestMethod } from "./mod.ts";

const a = new App();

a.route([RequestMethod.GET], "/", (req) => {
  req.respond({
    body: "Hello, World!",
  });
});

a.serve({ port: 3333 });
