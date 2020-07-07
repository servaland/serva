import { Route } from "./_route.ts";
import { RouteCallback } from "./_app.ts";

export interface RouteFactory {
  (route: Route): RouteCallback;
}

interface RouteApi {}

interface RouteMeta {
  method: string;
  path: string;
  paramNames: Array<string | number>;
}

export function route(
  callback: (api: RouteApi, meta: RouteMeta) => RouteCallback,
): RouteFactory {
  function routeFactory(route: Route) {
    return callback({}, {
      method: route.method,
      path: route.path,
      paramNames: route.paramNames,
    });
  }

  // signal to the app this is a factory
  Object.assign(routeFactory, {
    [Symbol.for("serva_factory")]: "route",
  });

  return routeFactory;
}
