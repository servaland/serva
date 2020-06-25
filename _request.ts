import {
  ServerRequest,
  Response,
} from "https://deno.land/std@0.57.0/http/mod.ts";
import { Route } from "./_route.ts";

export interface ServaRequest {
  readonly rawRequest: ServerRequest;

  // http request
  readonly url: URL;
  readonly method: string;
  readonly params: ReadonlyMap<string, string>;
  readonly headers: ReadonlyMap<string, string>;

  // response
  readonly responded: boolean;
  readonly response: Response;
  respond: (response: Response) => void;
}

/**
 * Creates a Serva request object.
 * 
 * @param {ServerRequest} req
 * @param {Route} route
 * @returns {ServaRequest}
 */
export default function create(req: ServerRequest, route: Route): ServaRequest {
  let response: Response = {};
  const proto = req.proto.split("/")[0].toLowerCase();
  const url = new URL(req.url, `${proto}://${req.headers.get("host")}`);

  return {
    url,
    rawRequest: req,
    method: req.method,
    params: route.params(url.pathname),
    headers: readonlyHeaders(req.headers),
    get response(): Response {
      return response;
    },
    get responded(): boolean {
      // @todo: is this a deterministic way to check if the write has started?
      return req.w.usedBufferBytes !== 0;
    },
    respond: (res: Response) => {
      // copy each response prop
      for (const [prop, value] of Object.entries(res)) {
        switch (prop) {
          case "trailers":
          case "status":
          case "body":
          case "headers":
            response[prop] = value;
        }
      }
    },
  };
}

/**
 * Returns a ReadonlyMap copy of given headers.
 * 
 * @param {Headers} headers
 * @returns {Map} 
 */
function readonlyHeaders(headers: Headers): ReadonlyMap<string, string> {
  const map = new Map();
  headers.forEach((value, key) => map.set(value, key));

  return map;
}