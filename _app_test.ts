import { main } from "./_app.ts";
import { asserts, http } from "./deps.ts";

const { assertEquals } = asserts;

Deno.test("serve default", async () => {
  const [server, stop] = await run("./example");

  assertEquals(server.listener.addr, {
    port: 4500,
    hostname: "0.0.0.0",
    transport: "tcp",
  });

  await stop();
});

Deno.test("serve host and port", async () => {
  const [server, stop] = await run("./example --port 8123 --host localhost");

  assertEquals(server.listener.addr, {
    port: 8123,
    hostname: "127.0.0.1",
    transport: "tcp",
  });

  await stop();
});

async function run(
  command: string
): Promise<[http.Server, () => Promise<void>]> {
  const [server, listener] = await main(command.split(/\s+/));

  return [
    server,
    async () => {
      server.close();
      await listener;
    },
  ];
}
