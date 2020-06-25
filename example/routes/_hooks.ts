import { registerHooks } from "../../registers.ts";

export default registerHooks(({ registerHook }, info) => {
  registerHook(async function root({ respond }, next) {
    const startTime = performance.now();
    await next();
    respond({
      headers: new Headers({
        "X-Duration": (performance.now() - startTime).toString(),
      }),
    });
  });
});
