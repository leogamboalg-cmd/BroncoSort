import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
        const professorResult = await client.searchProfessors(profQuery, {
          school_id: matchedSchool.id,
          page_size: 5,
        });

        const professorsFound = professorResult.professors || [];

        const exactMatch = professorsFound.find(
          (p) => normalizeName(p.name) === normalizeName(profQuery),
        );

        const professor = exactMatch || professorsFound[0] || null;

        console.log("====== PROFESSOR DEBUG ======");
        console.log("Query:", profQuery);
        console.log("All results:", JSON.stringify(professorsFound, null, 2));
        console.log("Chosen professor:", JSON.stringify(professor, null, 2));
        console.log("Professor ID field:", professor?.id);
        console.log("Professor legacyId field:", professor?.legacyId);
        console.log("=============================");

        if (!professor) {
          ratingsByName[profQuery] = {
            found: false,
            profName: null,
            rating: 0,
            numRatings: 0,
            id: 0,
          };
          continue;
        }

        const isExact =
          normalizeName(professor.name) === normalizeName(profQuery);

        ratingsByName[profQuery] = {
          found: isExact,
          profName: professor.name,
          rating: professor.overall_rating || 0,
          numRatings: professor.num_ratings || 0,
          id: professor.id,
        };
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
