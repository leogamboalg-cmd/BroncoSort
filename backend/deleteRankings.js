import { Redis } from "@upstash/redis";
import "dotenv/config";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PATTERN = "rmp:13914:*";

async function deleteAllCPPProfessorKeys() {
  const keys = await redis.keys(PATTERN);

  console.log(`Found ${keys.length} matching keys.`);

  let deleted = 0;
  let failed = 0;

  for (const key of keys) {
    try {
      const result = await redis.del(key);

      if (result === 1) {
        deleted++;
        console.log(`Deleted ${deleted}/${keys.length}: ${key}`);
      } else {
        console.log(`Already missing: ${key}`);
      }
    } catch (error) {
      failed++;
      console.error(`Failed to delete ${key}:`, error);
    }
  }

  console.log("\nFinished");
  console.log("Found:", keys.length);
  console.log("Deleted:", deleted);
  console.log("Failed:", failed);
}

deleteAllCPPProfessorKeys().catch((error) => {
  console.error("Script failed:", error);
  process.exitCode = 1;
});
