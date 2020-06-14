import { Serva } from "./serva.ts";
import { Response, ServerRequest } from "./deps.ts";

interface BaseContext {
  app: Serva;
  request: ServerRequest;
  url: URL;
}

export interface RequestContext extends BaseContext {
  responded: boolean;
  response: Response;
}

export function createContext({
  app,
  request,
  url,
}: BaseContext): RequestContext {
  const response: Response = {
    status: 200,
    headers: new Headers(),
  };
  let responded = false;

  const proxy = new Proxy(request, {
    get(target, key, receiver) {
      switch (key) {
        /**
         * We listen for server request respond so we can let the app kow the
         * developer explicitly responded to the request. This is to stop any
         * confusion between the context's respond method.
         */
        case "respond":
          return function respond(r: Response): Promise<void> {
            responded = true;
            // @ts-ignore
            return target.respond.apply(this, [r]);
          };

        default:
          return Reflect.get(target, key, receiver);
      }
    },
  });

  return {
    app,
    url,
    response,
    request: proxy,
    get responded(): boolean {
      return responded;
    },
  };
}
