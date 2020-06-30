// ./example/routes/index.post.ts
import { ServaRequest } from "../../mod.ts";

export default ({ response }: ServaRequest) => {
  response.headers = new Headers({
    "X-Powered-By": "Serva",
  });

  return "Wait a minute, please Mr. POST-man.";
};
