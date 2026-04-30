import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();

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

async function test() {
  const schoolName = "Cal Poly Pomona";
  const professorName = "Stephanie Marin-Rothman";

  // 1. Find school
  const schoolResult = await client.searchSchools(schoolName);
  const school = schoolResult.schools.find((s) =>
    s.name.toLowerCase().includes(schoolName.toLowerCase()),
  );

  if (!school) {
    console.log("❌ School not found");
    return;
  }

  console.log("✅ School:", school.name, "| ID:", school.id);

  // 2. Search professor
  const result = await client.searchProfessors(professorName, {
    school_id: school.id,
    page_size: 10,
  });

  const profs = result.professors || [];

  console.log("\n🔎 Raw Results:");
  profs.forEach((p, i) => {
    console.log(`${i + 1}.`, {
      name: p.name,
      normalized: normalizeName(p.name),
      rating: p.overall_rating,
      numRatings: p.num_ratings,
      id: p.id,
    });
  });

  // 3. Exact match check
  const exact = profs.find(
    (p) => normalizeName(p.name) === normalizeName(professorName),
  );

  console.log("\n🎯 Exact Match:");
  if (exact) {
    console.log("FOUND ✅", exact.name, exact.overall_rating);
  } else {
    console.log("NOT FOUND ❌");
  }
}

test().catch(console.error);
