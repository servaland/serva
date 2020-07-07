import { RouteCallback, OnRequestCallback } from "./_app.ts";
import { Route } from "./_route.ts";

export interface RouteFactory {
  (route: Route): [OnRequestCallback[], RouteCallback];
}

interface RouteApi {
  onRequest: (callback: OnRequestCallback) => void;
}

interface RouteMeta {
  method: string;
  path: string;
  paramNames: Array<string | number>;
}

export function route(
  callback: (api: RouteApi, meta: RouteMeta) => RouteCallback,
): RouteFactory {
  function routeFactory(route: Route): [any[], RouteCallback] {
    const hooks: any[] = [];
    const cb = callback({
      onRequest: hooks.push.bind(hooks),
    }, {
      method: route.method,
      path: route.path,
      paramNames: route.paramNames,
    });

    return [hooks, cb];
  }

  // signal to the app this is a factory
  Object.assign(routeFactory, {
    [Symbol.for("serva_factory")]: "route",
  });

  return routeFactory;
}
