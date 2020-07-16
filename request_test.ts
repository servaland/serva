import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { http } from "./deps.ts";
import createRequest from "./request.ts";
import createRoute from "./_route.ts";

Deno.test("servaRequestObject", () => {
  const mockRoute = createRoute(
    "GET",
    "/profile/[name]",
    "/routes/profile/[name].get.ts",
  );

  const mockRequest = new http.ServerRequest();
  mockRequest.proto = "HTTP/1.1";
  mockRequest.url = "/profile/chris?test=foo";
  mockRequest.method = "GET";
  mockRequest.headers = new Headers({
    "Host": "serva.land",
  });

  const request = createRequest(mockRequest, mockRoute);

  assertEquals(request, {
    url: new URL("http://serva.land/profile/chris?test=foo"),
    httpRequest: mockRequest,
    method: mockRequest.method,
    params: new Map([["name", "chris"]]),
    headers: mockRequest.headers,
    response: {
      headers: new Headers(),
    },
  });
});
