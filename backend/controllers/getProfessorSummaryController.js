import { RMPClient } from "ratemyprofessors-client";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Redis } from "@upstash/redis";

dotenv.config({ path: "../.env" });
const client = new RMPClient();
const API_KEY = process.env.GEMINI_API_KEY;
const SUPER_SECRET_KEY = process.env.SUPER_SECRET_KEY;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in ../.env");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

function normalizeName(name = "") {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const getProfessorSummary = async (req, res) => {
  try {
    const { school, professorName } = req.body ?? {};

    const secretKey = req.get("x-secret-key");

    if (!secretKey || secretKey !== SUPER_SECRET_KEY) {
      return res.status(401).json({ error: "Access denied" });
    }

    if (!school || !professorName) {
      return res.status(400).json({
        error: "Missing school or professorName",
      });
    }

    const schoolName = school.trim();
    const profName = professorName.trim();

    const schoolResult = await client.searchSchools(schoolName);
    const schools = schoolResult.schools || [];

    const matchedSchool = schools.find((s) =>
      s.name.toLowerCase().includes(schoolName.toLowerCase()),
    );

    if (!matchedSchool) {
      return res.status(404).json({ error: "School not found" });
    }

    const result = await client.searchProfessors(profName, {
      school_id: matchedSchool.id,
      page_size: 10,
    });

    const profs = result.professors || [];

    const exact = profs.find(
      (p) => normalizeName(p.name) === normalizeName(profName),
    );

    if (!exact) {
      return res.status(404).json({ error: "Professor not found" });
    }

    const cacheKey = `prof-summary:${matchedSchool.id}:${exact.id}`;

    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        response: typeof cached === "string" ? JSON.parse(cached) : cached,
        cached: true,
      });
    }

    const startTotal = Date.now();
    const startFetch = Date.now();

    let allRatings = "";
    let reviewCount = 0;
    const MAX_REVIEWS = 30;
    const MAX_CHARS = 80000;

    for await (const rating of client.iterProfessorRatings(exact.id)) {
      const comment = rating.comment?.trim();
      if (!comment) continue;

      allRatings += `
	Review ${reviewCount + 1}
	Course: ${rating.course ?? "Unknown"}
	Quality: ${rating.quality ?? "N/A"}
	Difficulty: ${rating.difficulty ?? "N/A"}
	Comment: ${comment}
	`;

      reviewCount++;

      if (reviewCount >= MAX_REVIEWS || allRatings.length > MAX_CHARS) {
        break;
      }
    }

    if (reviewCount === 0) {
      return res.status(404).json({ error: "No written reviews found" });
    }

    console.log(`RMP fetch took ${Date.now() - startFetch}ms`);
    console.log(`Total written reviews found: ${reviewCount}`);

    const startAI = Date.now();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: `
      You are an elite academic advisor extracting raw metrics from student reviews for a compact browser extension UI.
      Analyze the following raw student reviews for this professor. Be objective, direct, and fair. Do not exaggerate.
      
      CRITICAL ANALYSIS INSTRUCTIONS:
      1. Look for grading traps (e.g., losing points over spaces/brackets).
      2. Identify structural requirements (e.g., mandatory attendance, weekly quizzes).
      3. Evaluate the true difficulty and pace of lectures.
      4. Keep all array string elements under 6 words so they easily fit inside small HTML badges.

	 Professor: ${profName}
	 School: ${matchedSchool.name}
	 Written reviews analyzed: ${reviewCount}
      Raw Student Reviews:
      ${allRatings}
    `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            verdict: {
              type: "STRING",
              description:
                "A 3-word warning or recommendation banner style text (e.g., 'Avoid If Beginner', 'Take Office Hours', 'Heavy Workload')",
            },
            sentimentScore: {
              type: "INTEGER",
              description:
                "Overall approval rating from 0 (terrible) to 100 (loved by everyone) deduced from text tone",
            },
            tldrSummary: {
              type: "STRING",
              description:
                "One compact 18-25 word summary. Mention teaching style, workload, and grading. No more than one sentence.",
            },
            topPros: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Exactly 3 distinct positive takeaways. Max 5 words per item.",
            },
            topCons: {
              type: "ARRAY",
              items: { type: "STRING" },
              description:
                "Exactly 3 distinct negative takeaways or warnings. Max 5 words per item.",
            },
            examStyle: {
              type: "STRING",
              description:
                "2-4 words describing test patterns mentioned (e.g., 'Weekly Quizzes, Strict Coding', 'Heavy Projects, Midterms')",
            },
          },
          required: [
            "verdict",
            "sentimentScore",
            "tldrSummary",
            "topPros",
            "topCons",
            "examStyle",
          ],
        },
      },
    });

    const extensionPayload = JSON.parse(response.text);
    await redis.set(cacheKey, JSON.stringify(extensionPayload), {
      ex: 60 * 60 * 24 * 14,
    });

    console.log("\n--- Clean Structured Extension Payload ---");
    console.log(JSON.stringify(extensionPayload, null, 2));
    console.log(`AI summary took ${Date.now() - startAI}ms`);
    console.log(`Total took ${Date.now() - startTotal}ms`);
    console.log("\n--- Token Usage ---");
    console.dir(response.usageMetadata, { depth: null });

    return res.status(200).json({
      response: extensionPayload,
      cached: false,
    });
  } catch (error) {
    console.error("Professor summary error:", error);
    return res.status(500).json({ error: "Server error fetching data" });
  }
};
