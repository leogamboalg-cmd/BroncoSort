import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();

async function run() {
  for (let i = 0; i < 30; i++) {
    const start = Date.now();
    await client.searchProfessors("John");
    const ms = Date.now() - start;
    console.log(`#${i + 1}: ${ms}ms`);
  }
}

run();
