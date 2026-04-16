import { createServer } from "./server.js";

const TEST_NAME = "Brianna Posadas";
const TEST_SCHOOL = "Cal Poly Pomona";

async function run() {
  const app = createServer();
  let server;

  try {
    server = await new Promise((resolve) => {
      const nextServer = app.listen(0, "127.0.0.1", () => {
        resolve(nextServer);
      });
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to resolve test server address");
    }

    const query = new URLSearchParams({
      name: TEST_NAME,
      school: TEST_SCHOOL,
    });

    const url = `http://127.0.0.1:${address.port}/api/professor?${query.toString()}`;

    console.log(`[TEST] Requesting ${url}`);
    const response = await fetch(url);
    const body = await response.json();

    console.log(`[TEST] Status: ${response.status}`);
    console.log(JSON.stringify(body, null, 2));
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

run().catch((error) => {
  console.error("[TEST] Failed:", error);
  process.exit(1);
});
