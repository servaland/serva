import { Route } from "./_route.ts";
import { http } from "./deps.ts";

export interface ServaRequest {
  readonly rawRequest: http.ServerRequest;

  // http request
  readonly url: URL;
  readonly method: string;
  readonly params: ReadonlyMap<string, string>;
  readonly headers: Headers;

  // response
  readonly responded: boolean;
  readonly response: http.Response;
  respond: (response: http.Response) => void;
}

/**
 * Creates a Serva request object.
 * 
 * @param {ServerRequest} req
 * @param {Route} route
 * @returns {ServaRequest}
 */
export default function create(
  req: http.ServerRequest,
  route: Route,
): ServaRequest {
  const response: http.Response = {};
  const proto = req.proto.split("/")[0].toLowerCase();
  const url = new URL(req.url, `${proto}://${req.headers.get("host")}`);

  return {
    url,
    rawRequest: req,
    method: req.method,
    params: route.params(url.pathname),
    headers: req.headers,
    get response(): http.Response {
      return response;
    },
    get responded(): boolean {
      // @todo: is this a deterministic way to check if the write has started?
      return req.w.usedBufferBytes !== 0;
    },
    respond: (res: http.Response) => {
      // copy each response prop
      for (const [prop, value] of Object.entries(res)) {
        switch (prop) {
          case "trailers":
          case "status":
          case "body":
            response[prop] = value;
            break;

          case "headers":
            if (response.headers) {
              // merge headers
              res.headers!.forEach((value, name) => {
                response.headers!.set(name, value);
              });
            } else {
              response.headers = new Headers(res.headers!);
            }
            break;
        }
      }
    },
  };
}
