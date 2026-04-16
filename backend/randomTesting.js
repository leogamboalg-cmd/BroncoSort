import { RMPClient } from "ratemyprofessors-client";
const client = new RMPClient();

async function findSchoolAndProfessor(
  schoolName,
  professorName = "Thanh Nguyen",
) {
  const schoolResult = await client.searchSchools(schoolName || "");
  const school = schoolResult.schools.find((s) => s.name === "Cal Poly Pomona");
  const schoolId = school.id;
  const professorResult = await client.searchProfessors(professorName, {
    school_id: school.id,
    page_size: 5,
  });
  const professor = professorResult.professors[0];
  console.log(professor.name + ": " + professor.overall_rating);
  return professor;
}

findSchoolAndProfessor("Cal Poly Pomona");
