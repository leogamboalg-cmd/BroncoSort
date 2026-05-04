import "dotenv/config";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const keys = await redis.keys("rank:prof:*");

console.log(`Deleting ${keys.length} ranking keys...`);

for (const key of keys) {
    await redis.del(key);
}

console.log("Done.");