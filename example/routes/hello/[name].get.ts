import { registerRoute } from "../../../registers.ts";

export default registerRoute<{ name: string }>(({ registerHook }) => {
  registerHook(async ({ respond, params }, next) => {
    const name = params.get("name");
    if (name === "god") {
      return respond({
        body: "Stop trying to be god, that's not who you are! — Travis Scott",
      });
    }

    await next();
  });

  return ({ respond, params }) =>
    respond({ body: `Hello, ${params.get("name")}` });
});
