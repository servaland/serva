import { RouteCallback } from "../../registers.ts";

export default (): RouteCallback => (({ respond }) =>
  respond({
    body: "Hello from Serva.",
    headers: new Headers({
      "X-Powered-By": "Serva",
    }),
  }));
