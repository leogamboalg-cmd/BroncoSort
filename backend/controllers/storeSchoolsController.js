import "dotenv/config";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const TTL = 60 * 60 * 24 * 14; // 7 days

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

    const cacheKey = `request:school:${schoolBody.school.id}`;

    const existing = await redis.get(cacheKey);

    if (existing) {
      return res.status(409).json({
        error: "School already requested.",
      });
    }

    await redis.set(cacheKey, schoolBody, {
      ex: TTL,
    });

    res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to store school request.",
    });
  }
};
