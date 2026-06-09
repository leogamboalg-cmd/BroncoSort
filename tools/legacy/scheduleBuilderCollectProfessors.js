const containers = Array.from(
  document.querySelectorAll(
    ".cx-MuiGrid-root.cx-MuiGrid-container.cx-MuiGrid-spacing-xs-1",
  ),
);

const container = containers[1];
if (!container) {
  console.log("No Schedule Builder row container found");
}

const rows = Array.from(container.children);

const professorNames = [];

rows.forEach((row) => {
  const text = row.innerText.replace(/\s+/g, " ").trim();

  const possibleNames = ["Hao Ji", "Brianna Posadas", "Edwin Rodríguez"];

  for (const name of possibleNames) {
    if (text.includes(name)) {
      professorNames.push(name);
      break;
    }
  }
});

console.log("professorNames:", professorNames);
