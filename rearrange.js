let group = $0;

// climb up to container with multiple instructors
while (group) {
  const count = group.querySelectorAll?.('[id^="MTG_INSTR"]').length ?? 0;
  if (count > 1) break;
  group = group.parentElement;
}

// get top-level rows
const rows = Array.from(group.children).filter(
  (child) => child.tagName === "TR" && child.querySelector('[id^="MTG_INSTR"]'),
);

// fake ratings
const fakeRatings = {
  "Antoine Si": 4.8,
  "Qichao Dong": 4.2,
  "Edwin Rodríguez": 3.9,
  "John Korah": 4.5,
};

// map rows → {row, name, rating}
const data = rows.map((row) => {
  let name = row
    .querySelector('[id^="MTG_INSTR"]')
    .innerText.replace(/\s+/g, " ")
    .trim();

  // fix duplicate names like "John Korah John Korah"
  const parts = name.split(" ");
  if (parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");
    if (first === second) name = first;
  }

  return {
    row,
    name,
    rating: fakeRatings[name] ?? 0, // default if not found
  };
});

// sort DESC (highest first)
data.sort((a, b) => b.rating - a.rating);

// re-append rows in sorted order
data.forEach((item) => group.appendChild(item.row));

// debug
console.log(data.map((d) => `${d.name}: ${d.rating}`));
