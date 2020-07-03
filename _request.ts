import { Route } from "./_route.ts";
import { http } from "./deps.ts";

export interface ServaRequest {
  readonly httpRequest: http.ServerRequest;

  // http request
  readonly url: URL;
  readonly method: string;
  readonly params: ReadonlyMap<string, string>;
  readonly headers: Headers;

  // response
  readonly response: http.Response;
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
    httpRequest: req,
    method: req.method,
    params: route.params(url.pathname),
    headers: req.headers,
    get response(): http.Response {
      return response;
    },
  };
}
