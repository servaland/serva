// ./example/routes/index.post.ts
import { route } from "../../mod.ts";

export default route(() =>
  ({ response }) => {
    response.headers = new Headers({
      "X-Powered-By": "Serva",
    });

    return "Wait a minute, please Mr. POST-man.";
  }
);
