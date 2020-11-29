import { RequestHandler } from "../../../_app.ts";

const index: RequestHandler = (request, params) => {
  request.respond({
    headers: new Headers({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(params),
  });
};

export default index;
