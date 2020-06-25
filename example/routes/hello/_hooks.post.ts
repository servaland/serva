import { registerHooks } from "../../../registers.ts";

export default registerHooks(({ registerHook }, info) => {
  registerHook(function hello(_, next) {
    console.log("entered hello");
    return next();
  });
});
