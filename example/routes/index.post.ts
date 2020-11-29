import { RequestHandler } from "../../_app.ts";

const index: RequestHandler = (_, params) => {
  console.log(params);
  return new Promise((res) => {
    setTimeout(() => {
      res("Postman Pat!");
    }, 500);
  });
};

export default index;
