(async () => {
    const rows = [...document.querySelectorAll(".cx-MuiExpansionPanelSummary-root")];

    const isName = t => /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)+$/.test(t);

    const classes = rows.map(row => {
        const data = [...row.querySelectorAll('[role="cell"]')]
            .map(c => c.innerText.trim());

        const instructor = data.find(isName) || "TBA";

        return {
            instructor,
            rating: 0,
            block: row.closest(".cx-MuiGrid-item")
        };
    });

    const uniqueProfessorNames = [
        ...new Set(classes.map(c => c.instructor).filter(name => name !== "TBA"))
    ];

    const res = await fetch(`${API_BASE}/api/professor/ratings`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            school: "Cal Poly Pomona",
            professors: uniqueProfessorNames,
        }),
    });

    const data = await res.json();
    const ratingsByName = data.ratingsByName || {};

    classes.forEach(c => {
        c.rating = ratingsByName[c.instructor]?.rating || 0;
    });

    const parent = classes[0].block.parentElement;

    const sorted = [...classes].sort((a, b) => b.rating - a.rating);

    sorted.forEach((c, i) => {
        parent.insertBefore(c.block, parent.children[i]);
    });

    console.table(classes.map(c => ({
        instructor: c.instructor,
        rating: c.rating
    })));
})();