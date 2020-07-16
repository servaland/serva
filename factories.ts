import { RouteCallback, OnRequestCallback } from "./_app.ts";
import { Route } from "./_route.ts";

export interface RouteFactory {
  (route: Route): [OnRequestCallback[], RouteCallback];
}

export interface Hooksfactory {
  (route: Route): OnRequestCallback[];
}

interface HooksApi {
  route: Route;
  onRequest: (callback: OnRequestCallback) => void;
}

interface RouteApi extends HooksApi {}

export function route(
  callback: (api: RouteApi) => RouteCallback,
): RouteFactory {
  function routeFactory(route: Route): [OnRequestCallback[], RouteCallback] {
    const hooks: OnRequestCallback[] = [];
    return [hooks, callback({ onRequest: hooks.push.bind(hooks), route })];
  }

  // signal to the app this is a factory
  Object.assign(routeFactory, {
    [Symbol.for("serva_factory")]: "route",
  });

  return routeFactory;
}

export function hooks(callback: (api: HooksApi) => void): Hooksfactory {
  function hooksFactory(route: Route): OnRequestCallback[] {
    const hooks: OnRequestCallback[] = [];
    callback({ onRequest: hooks.push.bind(hooks), route });

    return hooks;
  }

  // signal to the app this is a factory
  Object.assign(hooksFactory, {
    [Symbol.for("serva_factory")]: "hooks",
  });

  return hooksFactory;
}
