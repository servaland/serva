import { ServaRequest } from "../../mod.ts";

export default ({ respond }: ServaRequest) =>
  respond({
    body: "Wait a minute, please Mr. POST-man",
    headers: new Headers({
      "X-Powered-By": "Serva",
    }),
  });
