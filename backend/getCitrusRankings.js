import { RMPClient } from "ratemyprofessors-client";
import { Redis } from "@upstash/redis";
import "dotenv/config";
console.log("Starting");
const departments = new Map();
const RANKING_TTL = 60 * 60 * 24 * 7;
const client = new RMPClient();
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

async function saveRankingsToRedis(departments) {
  let saved = 0;
  let queued = 0;

  const BATCH_SIZE = 100;
  let pipeline = redis.pipeline();

  for (const [department, professors] of departments.entries()) {
    const departmentTotal = professors.length;

    for (const professor of professors) {
      const ranking = {
        id: professor.id,
        name: professor.name,
        department,
        rank: professor.rank,
        topPercent: professor.topPercent,
        departmentTotal,
      };

      pipeline.set(`rank:prof:${professor.id}`, ranking, {
        ex: RANKING_TTL,
      });

      queued++;

      if (queued >= BATCH_SIZE) {
        console.log(`Saving Redis batch. Already saved: ${saved}`);

        await pipeline.exec();

        saved += queued;
        queued = 0;
        pipeline = redis.pipeline();
      }
    }
  }

  // Save the final partial batch.
  if (queued > 0) {
    await pipeline.exec();
    saved += queued;
  }

  console.log("Saved rankings:", saved);
}

async function getAllDepartmentsProfessors(schoolId) {
  let count = 0;

  for await (const prof of client.iterProfessorsForSchool(schoolId)) {
    count++;

    if (count % 50 === 0) {
      console.log("Current Professors:", count);
    }

    if (!departments.has(prof.department)) {
      departments.set(prof.department, []);
    }
    departments.get(prof.department).push(prof); // append
  }

  console.log("Number of departments:", departments.size);

  return count;
}

function getBayesianScore(prof, departmentAvg = 3.5, minReviews = 10) {
  const rating = prof.overall_rating ?? 0;
  const reviews = prof.num_ratings ?? 0;

  return (
    (reviews / (reviews + minReviews)) * rating +
    (minReviews / (reviews + minReviews)) * departmentAvg
  );
}

function sortProfessorsByDepartment(m) {
  for (const [dept, profs] of m.entries()) {
    const ratedProfs = profs.filter((p) => (p.num_ratings ?? 0) > 0);

    const departmentAvg =
      ratedProfs.length > 0
        ? ratedProfs.reduce((sum, p) => sum + (p.overall_rating ?? 0), 0) /
          ratedProfs.length
        : 3.5;

    profs.sort((a, b) => {
      const scoreA = getBayesianScore(a, departmentAvg, 10);
      const scoreB = getBayesianScore(b, departmentAvg, 10);

      return scoreB - scoreA;
    });
  }

  return m;
}

function addDepartmentPercentiles(m) {
  for (const [dept, profs] of m.entries()) {
    const total = profs.length;

    profs.forEach((prof, index) => {
      prof.rank = index + 1;

      prof.topPercent = Math.max(1, Math.round((index / total) * 100));
    });
  }
}

(async () => {
  try {
    const schoolId = 1849; // Cal Poly Pomona (replace if needed)

    const total = await getAllDepartmentsProfessors(schoolId);

    console.log("Total professors:", total);
    sortProfessorsByDepartment(departments);
    addDepartmentPercentiles(departments);
    await saveRankingsToRedis(departments);
    for (const [dept, profs] of departments.entries()) {
      console.log(`\n${dept} (${profs.length})`);

      console.table(
        profs.slice(0, 5).map((p, index) => ({
          rank: index + 1,
          name: `${p.name}`,
          rating: p.overall_rating ?? "N/A",
          numRatings: p.num_ratings ?? 0,
          topPercent: `Top ${p.topPercent}%`,
        })),
      );
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
})();
