import { registerHooks } from "../../registers.ts";

export default registerHooks(({ registerHook }, info) => {
  registerHook(function root(_, next) {
    console.log("entered root");
    return next();
  });
});
