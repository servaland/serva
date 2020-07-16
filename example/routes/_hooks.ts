// ./example/routes/_hooks.ts
import { hooks } from "../../mod.ts";

export default hooks(({ onRequest }) => {
  onRequest(async ({ url }, next) => {
    const { pathname } = url;

    console.log(`--> ${pathname}`);
    await next();
    console.log(`<-- ${pathname}`);
  });

  onRequest(async ({ response }, next) => {
    await next();
    response.headers.set("X-Powered-By", "Serva");
  });
});
