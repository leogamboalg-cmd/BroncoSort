import "dotenv/config";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const keys = await redis.keys("rmp:13914:*");

await Promise.all(keys.map(key => redis.del(key)));