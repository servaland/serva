import { ServaRequest } from "../../request.ts";

// ./example/routes/index.post.ts
export default async ({ body }: ServaRequest) => {
  const { name } = await body.json();

  return `Hello, ${name}!`;
};
