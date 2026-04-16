import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { RMPClient } from "ratemyprofessors-client";

const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? "3030", 10);
const DEFAULT_SCHOOL_NAME = "Cal Poly Pomona";
const RMP_BASE_URL = "https://www.ratemyprofessors.com/professor";
const client = new RMPClient();
const schoolCache = new Map();

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(dr|prof|professor|mr|mrs|ms)\.?\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNameTokens(value) {
  const normalized = normalizeName(value);
  return normalized ? normalized.split(" ") : [];
}

function getTokenScore(targetTokens, candidateTokens) {
  if (!targetTokens.length || !candidateTokens.length) {
    return 0;
  }

  let overlap = 0;

  for (const token of targetTokens) {
    if (candidateTokens.includes(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(targetTokens.length, candidateTokens.length);
}

function scoreProfessorMatch(targetName, professor) {
  const target = normalizeName(targetName);
  const candidate = normalizeName(professor?.name);

  if (!target || !candidate) {
    return 0;
  }

  if (target === candidate) {
    return 1;
  }

  const targetTokens = splitNameTokens(target);
  const candidateTokens = splitNameTokens(candidate);
  const sameLastName =
    targetTokens[targetTokens.length - 1] &&
    targetTokens[targetTokens.length - 1] ===
      candidateTokens[candidateTokens.length - 1];
  const sameFirstName =
    targetTokens[0] && targetTokens[0] === candidateTokens[0];
  const tokenScore = getTokenScore(targetTokens, candidateTokens);

  if (sameFirstName && sameLastName) {
    return 0.95;
  }

  if (sameLastName && tokenScore >= 0.5) {
    return 0.85;
  }

  return tokenScore;
}

function toProfessorResponse(inputName, professor, score, school) {
  if (!professor) {
    return {
      input_name: inputName,
      found: false,
      school: school?.name ?? null,
      school_id: school?.id ?? null,
      match_score: 0,
      professor: null,
    };
  }

  return {
    input_name: inputName,
    found: true,
    school: school?.name ?? professor.school?.name ?? null,
    school_id: school?.id ?? professor.school?.id ?? null,
    match_score: Number(score.toFixed(3)),
    professor: {
      id: professor.id,
      name: professor.name,
      department: professor.department ?? null,
      url: professor.url ?? `${RMP_BASE_URL}/${professor.id}`,
      overall_rating: professor.overall_rating ?? null,
      num_ratings: professor.num_ratings ?? null,
      percent_take_again: professor.percent_take_again ?? null,
      level_of_difficulty: professor.level_of_difficulty ?? null,
    },
  };
}

async function findSchoolByName(schoolName) {
  const normalizedSchoolName = normalizeName(schoolName || DEFAULT_SCHOOL_NAME);

  if (schoolCache.has(normalizedSchoolName)) {
    return schoolCache.get(normalizedSchoolName);
  }

  console.log(`[RMP] Searching school for "${schoolName}"`);
  const result = await client.searchSchools(schoolName || DEFAULT_SCHOOL_NAME);
  const school =
    result.schools.find(
      (entry) => normalizeName(entry.name) === normalizedSchoolName,
    ) ||
    result.schools.find((entry) =>
      normalizeName(entry.name).includes(normalizedSchoolName),
    ) ||
    null;

  if (school) {
    schoolCache.set(normalizedSchoolName, school);
  }

  return school;
}

async function findBestProfessorMatch(name, schoolName) {
  const school = await findSchoolByName(schoolName);

  if (!school) {
    return {
      input_name: name,
      found: false,
      school: schoolName,
      school_id: null,
      match_score: 0,
      professor: null,
      error: "School not found",
    };
  }

  console.log(`[RMP] Searching professor "${name}" at "${school.name}"`);

  const result = await client.searchProfessors(name, {
    school_id: school.id,
    page_size: 20,
  });

  let bestProfessor = null;
  let bestScore = 0;

  for (const professor of result.professors) {
    const currentScore = scoreProfessorMatch(name, professor);

    if (currentScore > bestScore) {
      bestProfessor = professor;
      bestScore = currentScore;
    }
  }

  if (!bestProfessor || bestScore < 0.5) {
    return toProfessorResponse(name, null, 0, school);
  }

  return toProfessorResponse(name, bestProfessor, bestScore, school);
}

function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", async (request, response) => {
    response.status(200).json({ ok: true });
  });

  app.get("/api/schools", async (request, response, next) => {
    try {
      const query = request.query.query || DEFAULT_SCHOOL_NAME;
      const result = await client.searchSchools(query);

      response.status(200).json({
        query,
        schools: result.schools,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/professor", async (request, response, next) => {
    try {
      const name = request.query.name;
      const schoolName = request.query.school || DEFAULT_SCHOOL_NAME;

      if (!name) {
        response
          .status(400)
          .json({ error: 'Missing required query parameter "name"' });
        return;
      }

      const result = await findBestProfessorMatch(name, schoolName);
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/professors/lookup", async (request, response, next) => {
    try {
      const schoolName = request.body.school_name || DEFAULT_SCHOOL_NAME;
      const names = Array.isArray(request.body.names)
        ? request.body.names.filter(Boolean)
        : [];

      if (!names.length) {
        response.status(400).json({
          error: 'Request body must include a non-empty "names" array',
        });
        return;
      }

      const results = [];

      for (const name of names) {
        const match = await findBestProfessorMatch(name, schoolName);
        results.push(match);
      }

      response.status(200).json({
        school_name: schoolName,
        results,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use((error, request, response, next) => {
    console.error("[RMP] Request failed:", error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  });

  return app;
}

const app = createServer();
const currentFilePath = fileURLToPath(import.meta.url);
let listener = null;

if (process.argv[1] && currentFilePath === process.argv[1]) {
  listener = app.listen(DEFAULT_PORT, () => {
    console.log(`[RMP] Server listening on http://localhost:${DEFAULT_PORT}`);
    console.log(`[RMP] Default school: ${DEFAULT_SCHOOL_NAME}`);
  });
}

process.on("SIGINT", async () => {
  console.log("\n[RMP] Shutting down");
  if (listener) {
    await new Promise((resolve) => listener.close(resolve));
  }
  await client.close();
  process.exit(0);
});

export {
  createServer,
  findBestProfessorMatch,
  findSchoolByName,
  normalizeName,
  scoreProfessorMatch,
};
