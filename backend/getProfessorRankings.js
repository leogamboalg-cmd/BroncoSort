import { RMPClient } from "ratemyprofessors-client";
import { Redis } from "@upstash/redis";
import "dotenv/config";

console.log("Starting");

const departments = new Map();
const RANKING_TTL = 60 * 60 * 24 * 14;

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

async function saveRankingsToRedis(departmentMap, schoolId) {
  let saved = 0;

  for (const [department, professors] of departmentMap.entries()) {
    const departmentTotal = professors.length;

    for (const professor of professors) {
      const professorData = {
        found: true,
        id: professor.id,
        profName: professor.name,
        department,

        rating: professor.overall_rating ?? 0,
        numRatings: professor.num_ratings ?? 0,
        percentTakeAgain: professor.percent_take_again ?? null,
        difficulty: professor.level_of_difficulty ?? null,

        ranking: {
          id: professor.id,
          name: professor.name,
          department,
          rank: professor.rank,
          topPercent: professor.topPercent,
          departmentTotal,
        },
      };

      const cacheKey = `rmp:prof:${schoolId}:${normalizeName(professor.name)}`;

      await redis.set(cacheKey, professorData, {
        ex: RANKING_TTL,
      });

      saved++;
      if (saved % 50 == 0) {
        console.log(`Current Professors: ${saved}`);
      }
    }
  }

  console.log("Saved professors:", saved);
}

async function getAllDepartmentsProfessors(schoolId) {
  let count = 0;

  for await (const professor of client.iterProfessorsForSchool(schoolId)) {
    count++;

    if (count % 50 === 0) {
      console.log("Current professors:", count);
    }

    const department = professor.department || "Unknown";

    if (!departments.has(department)) {
      departments.set(department, []);
    }

    departments.get(department).push(professor);
  }

  console.log("Number of departments:", departments.size);

  return count;
}

function getBayesianScore(
  professor,
  departmentAverage = 3.5,
  minimumReviews = 10,
) {
  const rating = professor.overall_rating ?? 0;
  const reviews = professor.num_ratings ?? 0;

  return (
    (reviews / (reviews + minimumReviews)) * rating +
    (minimumReviews / (reviews + minimumReviews)) * departmentAverage
  );
}

function sortProfessorsByDepartment(departmentMap) {
  for (const professors of departmentMap.values()) {
    const ratedProfessors = professors.filter(
      (professor) => (professor.num_ratings ?? 0) > 0,
    );

    const departmentAverage =
      ratedProfessors.length > 0
        ? ratedProfessors.reduce(
            (sum, professor) => sum + (professor.overall_rating ?? 0),
            0,
          ) / ratedProfessors.length
        : 3.5;

    professors.sort((professorA, professorB) => {
      const scoreA = getBayesianScore(professorA, departmentAverage, 10);

      const scoreB = getBayesianScore(professorB, departmentAverage, 10);

      return scoreB - scoreA;
    });
  }

  return departmentMap;
}

function addDepartmentPercentiles(departmentMap) {
  for (const professors of departmentMap.values()) {
    const total = professors.length;

    professors.forEach((professor, index) => {
      professor.rank = index + 1;

      professor.topPercent = Math.max(
        1,
        Math.ceil(((index + 1) / total) * 100),
      );
    });
  }
}

async function main() {
  try {
    const schoolId = 13914; // Cal Poly Pomona

    const total = await getAllDepartmentsProfessors(schoolId);

    console.log("Total professors:", total);

    sortProfessorsByDepartment(departments);
    console.log("Finished Sorting");
    addDepartmentPercentiles(departments);
    console.log("Finished adding department percentiles");
    await saveRankingsToRedis(departments, schoolId);

    for (const [department, professors] of departments.entries()) {
      console.log(`\n${department} (${professors.length})`);

      console.table(
        professors.slice(0, 5).map((professor) => ({
          rank: professor.rank,
          name: professor.name,
          rating: professor.overall_rating ?? "N/A",
          numRatings: professor.num_ratings ?? 0,
          topPercent: `Top ${professor.topPercent}%`,
        })),
      );
    }
  } catch (error) {
    console.error("Ranking update failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
