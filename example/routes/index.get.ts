import { registerRoute } from "../../registers.ts";

export default registerRoute(() =>
  ({ respond }) =>
    respond({
      body: "Hello from Serva",
      headers: new Headers({
        "X-Powered-By": "Serva",
      }),
    })
);
