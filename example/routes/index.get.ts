// ./example/routes/index.get.ts
import { route } from "../../mod.ts";

export default route(() => {
  return ({ response }) => {
    response.headers = new Headers({
      "X-Powered-By": "Serva",
    });

    return "Hello from Serva.";
  };
});
