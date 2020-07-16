import { Route } from "./_route.ts";
import { http } from "./deps.ts";

interface ServaResponse extends http.Response {
  body?: any; // allow routes to return anything
}

export interface ServaRequest {
  readonly httpRequest: http.ServerRequest;

  // http request
  readonly url: URL;
  readonly method: string;
  readonly params: ReadonlyMap<string, string>;
  readonly headers: Headers;

  // response
  readonly response: ServaResponse;
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
  const response: ServaResponse = {};
  const proto = req.proto.split("/")[0].toLowerCase();
  const url = new URL(req.url, `${proto}://${req.headers.get("host")}`);

  return {
    url,
    httpRequest: req,
    method: req.method,
    params: route.params(url.pathname),
    headers: req.headers,
    get response(): ServaResponse {
      return response;
    },
  };
}
