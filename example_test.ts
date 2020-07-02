import { delay } from "https://deno.land/std@0.57.0/async/delay.ts";
import {
  assertEquals,
} from "https://deno.land/std@0.57.0/testing/asserts.ts";

async function runStart() {
  const p = Deno.run({
    cmd: [
      Deno.execPath(),
      "run",
      "--allow-net",
      "--allow-read",
      "app.ts",
      "start",
      "--port",
      "4600",
      "example",
    ],
  });

  await delay(100);

  return p;
}

Deno.test("example", async () => {
  const p = await runStart();

  // GET /
  {
    const res = await fetch("http://0.0.0.0:4600");
    const body = await res.text();

    assertEquals(body, "Hello from Serva.");
  }

  // POST /
  {
    const res = await fetch("http://0.0.0.0:4600", {
      method: "POST",
    });
    const body = await res.text();

    assertEquals(body, "Wait a minute, please Mr. POST-man.");
  }

  p.close();
});
