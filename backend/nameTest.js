import { RMPClient } from "ratemyprofessors-client";

const client = new RMPClient();

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

async function test() {
  const schoolName = "Cal Poly Pomona";
  const professorName = "Stephanie Marin-Rothman";

  const schoolResult = await client.searchSchools(schoolName);
  const school = schoolResult.schools.find((s) =>
    s.name.toLowerCase().includes(schoolName.toLowerCase()),
  );

  if (!school) return;

  const result = await client.searchProfessors(professorName, {
    school_id: school.id,
    page_size: 10,
  });

  const profs = result.professors || [];

  const exact = profs.find(
    (p) => normalizeName(p.name) === normalizeName(professorName),
  );

  if (!exact) return;

  console.dir(exact, { depth: null });
}

test().catch(console.error);
