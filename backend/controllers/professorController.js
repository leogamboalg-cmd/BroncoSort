import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();
const cache = new Map();
const TTL = 1000 * 60 * 60 * 24; // 24 hours

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

export const findSchoolAndProfessors = async (req, res) => {
  try {
    const { school, professors } = req.body;

    if (!school || !Array.isArray(professors) || professors.length === 0) {
      return res.status(400).json({
        error: "Missing school or professors array",
      });
    }

    const cleanedProfessors = dedupeNames(professors);

    // 1. Find school once
    const schoolResult = await client.searchSchools(school);
    const matchedSchool = schoolResult.schools.find((s) =>
      s.name.toLowerCase().includes(school.toLowerCase()),
    );

    if (!matchedSchool) {
      return res.status(404).json({ error: "School not found" });
    }

    const ratingsByName = {};

    // 2. Search each professor within that school
    for (const profQuery of cleanedProfessors) {
      try {
        const cacheKey = `${matchedSchool.id}:${normalizeName(profQuery)}`;
        const cached = cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < TTL) {
          console.log("Cache hit:", profQuery);
          ratingsByName[profQuery] = cached.data;
          continue;
        }

        if (cached) {
          cache.delete(cacheKey);
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
            id: 0,
          };

          cache.set(cacheKey, {
            data: ratingsByName[profQuery],
            timestamp: Date.now(),
          });

          continue;
        }

        ratingsByName[profQuery] = {
          found: true,
          profName: exactMatch.name,
          rating: exactMatch.overall_rating || 0,
          numRatings: exactMatch.num_ratings || 0,
          id: exactMatch.id,
        };

        cache.set(cacheKey, {
          data: ratingsByName[profQuery],
          timestamp: Date.now(),
        });
      } catch (err) {
        ratingsByName[profQuery] = {
          found: false,
          profName: null,
          rating: 0,
          numRatings: 0,
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
