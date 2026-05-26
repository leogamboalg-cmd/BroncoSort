import "dotenv/config";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const TTL = 60 * 60 * 24 * 7; // 7 days

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const storeSchools = async (req, res) => {
  try {
    const schoolBody = req.body;

    if (!schoolBody?.school || !schoolBody?.pages) {
      return res.status(400).json({
        error: "Invalid payload.",
      });
    }

    const requestId = crypto.randomUUID();

    const cacheKey = `request:school:${schoolBody.school.id}:${requestId}`;

    await redis.set(cacheKey, schoolBody, {
      ex: TTL,
    });

    res.status(200).json({
      success: true,
      requestId,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to store school request.",
    });
  }
};
