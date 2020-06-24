import { ServaRequest } from "./_request.ts";

interface RegisterApi {
  registerHook: (...hooks: HookCallback[]) => void;
}

interface NextCallback {
  (): Promise<any>;
}

export interface HookCallback {
  (request: ServaRequest, next: NextCallback): Promise<any>;
}

export interface RouteCallback<P = {}> {
  (request: ServaRequest, params: P): Promise<any> | any;
}

interface RouteInfo {
  method: string;
  path: string;
  filePath: string;
}

interface Factory<R> {
  (routeInfo: RouteInfo): Promise<R>;
}

interface RegisterCallback<T = any> {
  (registerApi: RegisterApi, routeInfo: RouteInfo): Promise<T> | T;
}

type RouteFactoryReturn<P extends object> = [HookCallback[], RouteCallback<P>];

/**
 * Create a route factory for an application to consume on mount.
 *
 * @example
 *   registerRoute(() => {
 *     return function handler(context, params) {
 *       // route logic
 *     }
 *   });
 *
 * @param {function} register The route register callback
 * @returns {function(*): *} The route factory to be used by the app when mounting
 */
export function registerRoute<
  P extends object = {},
>(
  register: RegisterCallback<RouteCallback<P>>,
): Factory<RouteFactoryReturn<P>> {
  async function routeFactory(
    routeInfo: RouteInfo,
  ): Promise<RouteFactoryReturn<P>> {
    const hooks: HookCallback[] = [];
    return [
      hooks,
      await register(
        {
          registerHook: hooks.push.bind(hooks),
        },
        routeInfo,
      ),
    ];
  }

  // identify as a route factory, used when the app mounts
  // @ts-expect-error
  routeFactory[Symbol.for("serva.route_factory")] = true;

  return routeFactory;
}
