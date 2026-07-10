import { RMPClient } from "ratemyprofessors-client";
import "dotenv/config";
import { Redis } from "@upstash/redis";

const client = new RMPClient();
const TTL = 60 * 60 * 24; // 24 hours in seconds

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function cleanProfessorName(name) {
  return name
    .replace(/\bto be announced\b/gi, "")
    .replace(/\bTBA\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function dedupeNames(names) {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

function getProfessorCacheKey(schoolId, professorName) {
  return `rmp:prof:${schoolId}:${normalizeName(professorName)}`;
}

export const findSchoolAndProfessors = async (req, res) => {
  try {
    const { school, professors } = req.body;

    if (!school || !Array.isArray(professors) || professors.length === 0) {
      return res.status(400).json({
        error: "Missing school or professors array",
      });
    }

    const cleanedProfessors = dedupeNames(
      professors.map((name) => cleanProfessorName(name)),
    );

    // 1. Find school once
    const schoolCacheKey = `rmp:school:${normalizeName(school)}`;
    let matchedSchool = await redis.get(schoolCacheKey);

    if (!matchedSchool) {
      const schoolResult = await client.searchSchools(school);
      matchedSchool = schoolResult.schools.find((s) =>
        s.name.toLowerCase().includes(school.toLowerCase()),
      );

      if (!matchedSchool) {
        return res.status(404).json({ error: "School not found" });
      }

      await redis.set(schoolCacheKey, matchedSchool, {
        ex: TTL,
      });
    }

    const ratingsByName = {};

    const cacheKeys = cleanedProfessors.map((professor) =>
      getProfessorCacheKey(matchedSchool.id, professor),
    );

    const cachedResults =
      cacheKeys.length > 0 ? await redis.mget(...cacheKeys) : [];

    // 2. Search each professor within that school
    for (let i = 0; i < cleanedProfessors.length; i++) {
      const profQuery = cleanedProfessors[i];
      const cacheKey = cacheKeys[i];
      const cached = cachedResults[i];

      try {
        if (cached) {
          ratingsByName[profQuery] = cached;

          continue;
        }

        const professorResult = await client.searchProfessors(profQuery, {
          school_id: matchedSchool.id,
          page_size: 20,
        });

        const professorsFound = professorResult.professors || [];
        console.log("Query:", profQuery);
        console.log("Normalized query:", normalizeName(profQuery));
        console.log(
          "Results:",
          professorsFound.map((p) => ({
            name: p.name,
            normalized: normalizeName(p.name),
            rating: p.overall_rating,
            id: p.id,
            difficulty: p.level_of_difficulty,
            percentTakeAgain: p.percent_take_again,
            department: p.department,
          })),
        );

        const exactMatch = professorsFound.find(
          (p) => normalizeName(p.name) === normalizeName(profQuery),
        );

        if (!exactMatch) {
          ratingsByName[profQuery] = {
            found: false,
            profName: null,
            rating: 0,
            numRatings: 0,
            ranking: null,
            id: null,
            difficulty: null,
            percentTakeAgain: null,
            department: null,
          };

          await redis.set(cacheKey, ratingsByName[profQuery], {
            ex: TTL,
          });

          continue;
        }
        const numRatings = exactMatch.num_ratings || 0;

        ratingsByName[profQuery] = {
          found: true,
          profName: exactMatch.name,
          rating: exactMatch.overall_rating || 0,
          numRatings: exactMatch.num_ratings || 0,
          ranking: null,
          id: exactMatch.id,
          difficulty: exactMatch.level_of_difficulty ?? null,
          percentTakeAgain: exactMatch.percent_take_again ?? null,
          department: exactMatch.department ?? null,
        };

        await redis.set(cacheKey, ratingsByName[profQuery], {
          ex: TTL,
        });
      } catch (err) {
        ratingsByName[profQuery] = {
          found: false,
          profName: null,
          rating: 0,
          numRatings: 0,
          ranking: null,
          id: null,
          difficulty: null,
          percentTakeAgain: null,
          department: null,
          error: "Lookup failed",
        };
      }
    }

    return res.json({
      schoolFound: matchedSchool.name,
      ratingsByName,
    });
  } catch (error) {
    console.error("Server error fetching professor data:", error);
    return res.status(500).json({
      error: "Server error fetching data",
    });
  }
};
