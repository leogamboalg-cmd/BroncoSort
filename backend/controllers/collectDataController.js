//collectDataController.js

import "dotenv/config";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL = 60 * 60 * 24 * 7;

export const collectData = async (req, res) => {
  try {
    const {
      hostname,
      pathname,
      capturedAt,
      detection,
      selectorHints,
      counts,
      skeletons,
      siblingSignatures,
    } = req.body;

    if (!hostname || !skeletons?.table) {
      return res.status(400).json({
        error: "Missing hostname or table skeleton data",
      });
    }

    const cleanHostname = hostname.toLowerCase();

    const cacheKey = `request:dom:${cleanHostname}`;

    const dataToStore = {
      hostname: cleanHostname,
      pathname: pathname || "",
      capturedAt: capturedAt || new Date().toISOString(),
      detection: detection || {},
      selectorHints: selectorHints || {},
      counts: counts || {},
      skeletons: {
        table: skeletons.table,
        movableBlock: skeletons.movableBlock || "",
        groupContainerPreview: skeletons.groupContainerPreview || "",
      },
      siblingSignatures: siblingSignatures || [],
    };

    await redis.set(cacheKey, dataToStore, { ex: TTL });

    console.log(`[Success] DOM context stored for: ${cleanHostname}`);

    return res.status(200).json({
      message: "Structure received successfully",
      school: cleanHostname,
      saved: {
        hasTable: Boolean(dataToStore.skeletons.table),
        hasMovableBlock: Boolean(dataToStore.skeletons.movableBlock),
        hasGroupContainerPreview: Boolean(
          dataToStore.skeletons.groupContainerPreview,
        ),
        siblingCount: dataToStore.counts.siblingCount || 0,
      },
    });
  } catch (error) {
    console.error("Server error during DOM collection:", error);

    return res.status(500).json({
      error: "Server error saving structure",
    });
  }
};
