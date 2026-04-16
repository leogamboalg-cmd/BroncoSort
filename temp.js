// save code

// this rearranges the professors with hard-coded ratings
// 1. find the current course group from selected instructor ($0)
// 1. find the current course group from selected instructor ($0)

let group = $0;

while (group) {
  const count = group.querySelectorAll?.('[id^="MTG_INSTR"]').length ?? 0;
  if (count > 1) break;
  group = group.parentElement;
}

// 2. get only the real rows for this course block
const rows = Array.from(group.children).filter(
  (child) => child.tagName === "TR" && child.querySelector('[id^="MTG_INSTR"]'),
);

// 3. build data just for these rows
const data = rows.map((row) => {
  let name = row
    .querySelector('[id^="MTG_INSTR"]')
    .innerText.replace(/\s+/g, " ")
    .trim();

  // fix duplicate rendered names like "John Korah John Korah"
  const parts = name.split(" ");
  if (parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");
    if (first === second) name = first;
  }

  return { name, row };
});

// 4. fake ratings
const fakeRatings = {
  "Antoine Si": 4.8,
  "Qichao Dong": 4.2,
  "Edwin Rodríguez": 3.9,
  "John Korah": 4.5,
};

// 5. sort only this course block's rows
data.sort((a, b) => {
  const rA = fakeRatings[a.name] || 0;
  const rB = fakeRatings[b.name] || 0;
  return rB - rA;
});

// 6. move only these rows inside this same group
data.forEach((item) => {
  group.appendChild(item.row);
});

// 7. confirm order
console.log(data.map((item) => item.name));
