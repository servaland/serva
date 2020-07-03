// ./example/routes/index.get.ts
import { ServaRequest } from "../../../mod.ts";

export default ({ response, params }: ServaRequest) => {
  response.headers = new Headers({
    "X-Powered-By": "Serva",
  });

  return `Welcome ${params.get("name")}.`;
};
