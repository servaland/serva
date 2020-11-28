import { RequestHandler } from "../../_app.ts";

const index: RequestHandler = () => {
  return new Promise((res) => {
    setTimeout(() => {
      res("Postman Pat!");
    }, 500);
  });
};

export default index;
