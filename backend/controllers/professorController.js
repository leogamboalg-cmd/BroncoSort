import { RMPClient } from "ratemyprofessors-client";
const client = new RMPClient();

export const findSchoolAndProfessor = async (req, res) => {
  try {
    // Get everything from the request query
    // Example URL: /api/search?school=Cal Poly Pomona&prof=Thanh Nguyen
    const schoolQuery = req.query.school;
    const profQuery = req.query.prof;

    if (!schoolQuery || !profQuery) {
      return res
        .status(400)
        .json({ error: "Missing school or prof parameter" });
    }

    // 1. Search for the school provided by the extension
    const schoolResult = await client.searchSchools(schoolQuery);
    // Find the closest name match
    const school = schoolResult.schools.find((s) =>
      s.name.toLowerCase().includes(schoolQuery.toLowerCase()),
    );
    // console.log(school);
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    // 2. Search for the professor within that specific school ID
    const professorResult = await client.searchProfessors(profQuery, {
      school_id: school.id,
      page_size: 5,
    });
    console.log(professorResult);
    const professor = professorResult.professors[0];

    if (!professor) {
      return res.status(404).json({ error: "Professor not found" });
    }

    if (professor.name != profQuery) {
      return res.status(200).json({
        found: false,
        message: "No exact match found",
        rating: 0, // or null, to help your "put at the bottom" sorting logic
      });
    }

    // 3. Return the dynamic results
    res.json({
      schoolFound: school.name,
      profName: professor.name,
      rating: professor.overall_rating,
      numRatings: professor.num_ratings,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error fetching data" });
  }
};
