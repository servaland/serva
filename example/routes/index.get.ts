// ./example/routes/index.get.ts
import { ServaRequest } from "../../mod.ts";

export default ({ response }: ServaRequest) => {
  response.headers = new Headers({
    "X-Powered-By": "Serva",
  });

  return "Hello from Serva.";
};
