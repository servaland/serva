import { RequestHandler } from "../../_app.ts";

const index: RequestHandler = (request) => {
  request.respond({
    body: "Hello, World!",
  });
};

export default index;
