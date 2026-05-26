import "dotenv/config";

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;

export const searchSchools = async (req, res) => {
  try {
    const query = req.query.q;

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const url = new URL("https://api.data.gov/ed/collegescorecard/v1/schools");

    url.searchParams.set("api_key", API_KEY);
    url.searchParams.set("school.name", query);

    url.searchParams.set(
      "fields",
      "id,school.name,school.city,school.state,school.school_url",
    );

    url.searchParams.set("per_page", "10");

    const apiRes = await fetch(url);

    if (!apiRes.ok) {
      throw new Error(`College API error: ${apiRes.status}`);
    }

    const data = await apiRes.json();

    const schools = data.results.map((school) => ({
      id: school.id,
      name: school["school.name"],
      city: school["school.city"],
      state: school["school.state"],
      website: school["school.school_url"],
    }));

    res.status(200).json(schools);
  } catch (err) {
    console.error("School search failed:", err);

    res.status(500).json({
      error: "School search failed",
    });
  }
};
