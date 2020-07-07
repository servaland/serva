import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import createRoute from "./_route.ts";
import { pathToRegexp } from "./deps.ts";

Deno.test("basicRouteObject", () => {
  const { params, ...route } = createRoute("GET", "/", "/routes/index.get.ts");

  assertEquals(route, {
    filePath: "/routes/index.get.ts",
    path: "/",
    method: "GET",
    paramNames: [],
    regexp: pathToRegexp.pathToRegexp("/"),
  });
});

Deno.test("nonEndingRouteObject", () => {
  const { params, ...route } = createRoute("GET", "/*", "/routes/_hook.ts");

  assertEquals(route, {
    filePath: "/routes/_hook.ts",
    path: "/*",
    method: "GET",
    paramNames: [],
    regexp: pathToRegexp.pathToRegexp("/", [], {
      end: false,
    }),
  });
});

Deno.test("routeParams", () => {
  const { params, paramNames } = createRoute(
    "GET",
    "/[first]-[last]/comments/[comment]/view",
    "./routes/[first]-[last]/comments/[comment]/view.get.ts",
  );

  assertEquals(paramNames, ["first", "last", "comment"]);
  assertEquals(
    params("/chris-turner/comments/123/view"),
    new Map([["first", "chris"], ["last", "turner"], ["comment", "123"]]),
  );
});

Deno.test("routeParamsNone", () => {
  const { params } = createRoute(
    "GET",
    "/profile/[name]",
    "./routes/profile/[name].get.ts",
  );

  assertEquals(params("/does/not/match"), new Map());
});
