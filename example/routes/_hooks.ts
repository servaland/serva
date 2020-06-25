import { registerHooks } from "../../registers.ts";

export default registerHooks(({ registerHook }, info) => {
  registerHook(async function root({ response }, next) {
    const startTime = performance.now();
    await next();
    response.headers?.append(
      "X-DURATION",
      (performance.now() - startTime).toString(),
    );
  });
});
