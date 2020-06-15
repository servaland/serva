import {
  HTTPOptions,
  Status,
  Server,
  ServerRequest,
  serve,
} from "./deps.ts";
import { Route, RequestMethod } from "./route.ts";
import { createContext, RequestContext } from "./context.ts";

interface MiddlewareCalback {
  (c: RequestContext, next: () => Promise<any>): any;
}

interface EndpointCallback {
  (c: RequestContext, ...params: any[]): any;
}

class AlreadyServing extends Error {
  constructor() {
    super("App already serving");
  }
}

class RouteExists extends Error {
  public constructor(methods: RequestMethod[], path: string) {
    super(`Route already exists for: [${methods}] ${path}`);
  }
}

export class Serva {
  private server: Server | null = null;
  private routes: [Route, EndpointCallback][] = [];
  private middleware: [Route, MiddlewareCalback][] = [];

  public route(
    methods: RequestMethod[],
    path: string,
    callback: EndpointCallback,
  ): Route {
    const route = Route.for(methods, path);

    if (this.routes.find(([r]) => r === route)) {
      throw new RouteExists(methods, path);
    }

    this.routes.push([route, callback]);

    return route;
  }

  public use(
    methods: RequestMethod[],
    path: string,
    callback: MiddlewareCalback,
  ): Route {
    const route = Route.for(methods, path);

    this.middleware.push([route, callback]);

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

  private async handler(request: ServerRequest) {
    const url = new URL(request.url, "https://serva.land");

    const matched = this.routes.find(([route]) =>
      route.test(request.method, url.pathname)
    );
    if (!matched) {
      return request.respond({
        status: Status.NotFound,
      });
    }

    const [route, endpoint] = matched;
    const params = route.params(url.pathname);

    const middleware = this.middleware.filter(([route]) =>
      route.test(request.method, url.pathname)
    );

    const callbacks = middleware.map(([, callback]) => callback);

    // add the endpoint to the stack
    callbacks.push(async (c, next) => {
      const body = await endpoint(c, ...params.map(([, v]) => v)); // endpoints don't go next
      if (body !== undefined) {
        c.response.body = body;
      }

      return next();
    });

    // list of de-duped routes
    const routes = middleware.map(([r]) => r).filter((r, i, a) =>
      a.indexOf(r) !== i
    );
    routes.push(route);

    const context = createContext({
      app: this,
      request,
      url,
    });

    try {
      await dispatch(
        callbacks,
        context,
      );
    } catch (err) {
      // todo: error handling
      throw err;
    } finally {
      // make sure we respond
      if (!context.responded) {
        context.request.respond(context.response);
      }
    }
  }
}

async function dispatch(
  callbacks: (MiddlewareCalback)[],
  context: RequestContext,
): Promise<any> {
  let i = -1;

  const next = (current = 0): Promise<any> => {
    if (current <= i) {
      throw new Error("next() already called");
    }

    const cb = callbacks[i = current];

    return Promise.resolve(
      cb ? cb(context, next.bind(undefined, i + 1)) : undefined,
    );
  };

  return next();
}
