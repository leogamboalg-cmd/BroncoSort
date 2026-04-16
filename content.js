// 1. build data
const instructors = document.querySelectorAll('[id^="MTG_INSTR"]');

const data = Array.from(instructors).map((el) => {
  let name = el.innerText.replace(/\s+/g, " ").trim();

  // fix duplicate names like "John Korah John Korah"
  const parts = name.split(" ");
  if (parts.length % 2 === 0) {
    const half = parts.length / 2;
    const first = parts.slice(0, half).join(" ");
    const second = parts.slice(half).join(" ");
    if (first === second) name = first;
  }

  return {
    name,
    row: el.closest("tr"),
  };
});

// 2. fake ratings
const fakeRatings = {
  "Antoine Si": 4.8,
  "Qichao Dong": 4.9,
  "Edwin Rodríguez": 3.9,
  "John Korah": 4.5,
};

// 3. sort
data.sort((a, b) => {
  const rA = fakeRatings[a.name] || 0;
  const rB = fakeRatings[b.name] || 0;
  return rB - rA;
});

// 4. move rows
const tbody = document.querySelector("tbody");

data.forEach((item) => {
  tbody.appendChild(item.row);
});

// let group = $0;

// while (group) {
//   const count = group.querySelectorAll?.('[id^="MTG_INSTR"]').length ?? 0;
//   if (count > 1) break;
//   group = group.parentElement;
// }

// const rows = Array.from(group.children).filter(
//   (child) => child.tagName === "TR" && child.querySelector('[id^="MTG_INSTR"]'),
// );

// console.log("top-level rows:", rows.length);

// console.log(
//   rows.map((row) =>
//     row
//       .querySelector('[id^="MTG_INSTR"]')
//       .innerText.replace(/\s+/g, " ")
//       .trim(),
//   ),
// );
