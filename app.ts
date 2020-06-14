import { HTTPOptions, Status, Server, ServerRequest, serve } from "./deps.ts";
import { Route, RequestMethod } from "./route.ts";

interface MiddlewareCalback {
  (req: ServerRequest, next: () => Promise<any>): any;
}

interface EndpointCallback {
  (req: ServerRequest): any;
}

class AlreadyServing extends Error {
  constructor() {
    super("App already serving");
  }
}

export class App {
  private server: Server | null = null;
  private routes: [Route, EndpointCallback][] = [];

  public route(
    methods: RequestMethod[],
    path: string,
    callback: EndpointCallback,
  ): Route {
    const route = Route.fresh(methods, path);

    this.routes.push([route, callback]);

    return route;
  }

  public async serve(addr: string | HTTPOptions) {
    if (this.server) {
      throw new AlreadyServing();
    }

    this.server = serve(addr);
    for await (const req of this.server) {
      this.handler(req);
    }
  }

  private handler(req: ServerRequest) {
    const url = new URL(req.url, "https://serva.land");
    const matched = this.routes.find(([route]) =>
      route.test(req.method, url.pathname)
    );

    if (!matched) {
      return req.respond({
        status: Status.NotFound,
      });
    }

    const [route, callback] = matched;

    dispatch([callback], req);
  }
}

function dispatch(
  callbacks: (MiddlewareCalback)[],
  req: ServerRequest,
): Promise<any> {
  let i = -1;

  const next = (current = 0): Promise<any> => {
    if (current <= i) {
      throw new Error("next() already called");
    }

    const cb = callbacks[i = current];

    return Promise.resolve(
      cb ? cb(req, next.bind(undefined, i + 1)) : undefined,
    );
  };

  try {
    return next();
  } catch (err) {
    return Promise.reject(err);
  }
}
