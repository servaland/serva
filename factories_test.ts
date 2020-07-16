import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.57.0/testing/asserts.ts";
import { route } from "./factories.ts";
import createRoute from "./_route.ts";

Deno.test("routeFactory", () => {
  let inner = false;
  const r = createRoute("GET", "/", "./routes/index.get.ts");
  const hook = () => {};
  const callback = () => {};

  const factory = route(({ route, onRequest }) => {
    inner = true; // spy
    assertEquals(route, r);

    onRequest(hook);

    return callback;
  });

  const res = factory(r);

  assert(inner);
  assertEquals(res, [[hook], callback]);
});
