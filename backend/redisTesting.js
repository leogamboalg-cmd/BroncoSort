import "dotenv/config";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function run() {
  console.log("URL exists:", !!process.env.UPSTASH_REDIS_REST_URL);
  console.log("TOKEN exists:", !!process.env.UPSTASH_REDIS_REST_TOKEN);

  await redis.set("test:key", "hello world", {
    ex: 120,
  });

  const value = await redis.get("test:key");
  console.log("Retrieved:", value);
}

run();
