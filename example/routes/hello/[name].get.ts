import { registerRoute } from "../../../registers.ts";
import { Route } from "../../../_route.ts";

export default registerRoute<{ name: string }>(({ registerHook }) => {
  registerHook((_, next) => {
    return next();
  });

  return (request, { name }) => request.respond({ body: `Hello, ${name}` });
});
