// ./example/routes/index.get.ts
import { route } from "../../../mod.ts";

export default route(() =>
  ({ response, params }) => {
    response.headers = new Headers({
      "X-Powered-By": "Serva",
    });

    return `Welcome ${params.get("name")}.`;
  }
);
