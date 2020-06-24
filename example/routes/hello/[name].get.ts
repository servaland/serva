import { registerRoute } from "../../../registers.ts";

export default registerRoute<{ name: string }>(({ registerHook }) => {
  registerHook(async ({ respond, params }, next) => {
    await next();

    const name = params.get("name");
    if (name === "chris") {
      respond({
        body: "Fuck you!",
      });
    }
  });

  return ({ respond, params }) =>
    respond({ body: `Hello, ${params.get("name")}` });
});
