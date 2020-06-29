import { ServaRequest } from "../../mod.ts";

export default ({ respond }: ServaRequest) =>
  respond({
    body: "Hello from Serva.",
    headers: new Headers({
      "X-Powered-By": "Serva",
    }),
  });
