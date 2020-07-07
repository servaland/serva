// ./example/routes/index.get.ts
import { route } from "../../mod.ts";

export default route(({ onRequest }) => {
  onRequest(async (_, next) => {
    console.log("before");
    await next();
    console.log("after");
  });

  return ({ response }) => {
    response.headers = new Headers({
      "X-Powered-By": "Serva",
    });

    console.log("route");

    return "Hello from Serva.";
  };
});
