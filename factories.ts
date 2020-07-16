import { RouteCallback, OnRequestCallback } from "./_app.ts";
import { Route } from "./_route.ts";

export interface RouteFactory {
  (route: Route): [OnRequestCallback[], RouteCallback];
}

interface RouteApi {
  route: Route;
  onRequest: (callback: OnRequestCallback) => void;
}

export function route(
  callback: (api: RouteApi) => RouteCallback,
): RouteFactory {
  function routeFactory(route: Route): [any[], RouteCallback] {
    const hooks: any[] = [];
    return [hooks, callback({ onRequest: hooks.push.bind(hooks), route })];
  }

  // signal to the app this is a factory
  Object.assign(routeFactory, {
    [Symbol.for("serva_factory")]: "route",
  });

  return routeFactory;
}
