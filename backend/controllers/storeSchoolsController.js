// storeSchoolsController.js

import "dotenv/config";
import { Redis } from "@upstash/redis";
import crypto from "crypto";
import { BUILT_IN_SCHOOLS } from "../config/supportedSchools.js";

const TTL = 60 * 60 * 24 * 14; // 14 days
const RATE_LIMIT_TTL = 60 * 10; // 10 minutes
const MAX_REQUESTS_PER_IP_PER_SCHOOL = 3;

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

    const schoolName = schoolBody.school.name?.trim();

    if (BUILT_IN_SCHOOLS.has(schoolName)) {
      return res.status(400).json({
        error: "This school is already supported.",
      });
    }

    const schoolId = schoolBody.school.id;
    const requestId = crypto.randomUUID();
    const storedAt = new Date().toISOString();

    const requestSummary = {
      schoolName: schoolBody.school.name,
      website: schoolBody.school.website,
      pageUrl: schoolBody.pageUrl,
      storedAt,
    };

    const hashedIp = crypto
      .createHash("sha256")
      .update(req.ip || "unknown")
      .digest("hex");

    const ipKey = `request:ip:${hashedIp}:${schoolId}`;
    const recentCount = await redis.incr(ipKey);

    if (recentCount === 1) {
      await redis.expire(ipKey, RATE_LIMIT_TTL);
    }

    if (recentCount > MAX_REQUESTS_PER_IP_PER_SCHOOL) {
      return res.status(429).json({
        error: "Too many requests for this school. Try again later.",
      });
    }

    const cacheKey = `request:school:${schoolId}:${requestId}`;
    const schoolIndexKey = `request:school-index:${schoolId}`;

    const dataToStore = {
      ...schoolBody,
      requestId,
      storedAt,
      requestSummary,
    };

    await redis.set(cacheKey, dataToStore, {
      ex: TTL,
    });

    await redis.lpush(schoolIndexKey, cacheKey);
    await redis.expire(schoolIndexKey, TTL);

    return res.status(200).json({
      success: true,
      requestId,
    });
  } catch (err) {
    console.error("Failed to store school request:", err.message);

    return res.status(500).json({
      error: "Failed to store school request.",
    });
  }
};
