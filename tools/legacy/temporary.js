async function collectScheduleContext() {
  function getDocs(doc = document, docs = []) {
    docs.push(doc);

    for (const frame of doc.querySelectorAll("iframe")) {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow.document;
        if (frameDoc) getDocs(frameDoc, docs);
      } catch { }
    }

    return docs;
  }

  function getHeaderTexts(table) {
    return [...table.querySelectorAll("th")]
      .map(th => th.textContent.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function hasSemanticScheduleHeaders(table) {
    const headers = getHeaderTexts(table).map(h => h.toLowerCase());

    const hasInstructor = headers.some(h =>
      h.includes("instructor") ||
      h.includes("professor") ||
      h.includes("faculty") ||
      h.includes("teacher")
    );

    const hasSection = headers.some(h =>
      h.includes("section") ||
      h.includes("class")
    );

    const hasTimeOrRoom = headers.some(h =>
      h.includes("day") ||
      h.includes("time") ||
      h.includes("meeting") ||
      h.includes("room") ||
      h.includes("location")
    );

    return hasInstructor && hasSection && hasTimeOrRoom;
  }

  function hasFallbackSchedulePattern(table) {
    const id = table.id || "";
    const text = table.innerText.toLowerCase();

    return (
      id.toLowerCase().includes("schedule") ||
      id.toLowerCase().includes("meeting") ||
      id.toLowerCase().includes("class") ||
      table.querySelector('[id*="INSTR"], [name*="INSTR"]') ||
      (
        text.includes("instructor") &&
        text.includes("section") &&
        (text.includes("day") || text.includes("time") || text.includes("room"))
      )
    );
  }

  function isScheduleTable(table) {
    return hasSemanticScheduleHeaders(table) || hasFallbackSchedulePattern(table);
  }

  function findBestTable() {
    const tables = getDocs()
      .flatMap(doc => [...doc.querySelectorAll("table")])
      .filter(isScheduleTable)
      .sort((a, b) => a.outerHTML.length - b.outerHTML.length);

    console.table(tables.slice(0, 10).map((table, index) => ({
      index,
      id: table.id,
      size: table.outerHTML.length,
      rows: table.querySelectorAll("tr").length,
      cells: table.querySelectorAll("td").length,
      headers: getHeaderTexts(table).join(" | "),
      semantic: hasSemanticScheduleHeaders(table),
      fallback: hasFallbackSchedulePattern(table)
    })));

    return tables[0] || null;
  }

  function scheduleTableCount(el) {
    return [...el.querySelectorAll("table")].filter(isScheduleTable).length;
  }

  function findMovableBlock(table) {
    let current = table;
    let bestMatch = table;

    while (current && current !== document.body) {
      const parent = current.parentElement;

      if (!parent) {
        break;
      }

      const siblings = [...parent.children];

      const matchingSiblings = siblings.filter(sibling => {
        return scheduleTableCount(sibling) === 1;
      });

      if (matchingSiblings.length >= 2) {
        bestMatch = current;
      }

      current = parent;
    }

    return bestMatch;
  }

  function findGroupContainer(movableBlock) {
    const parent = movableBlock.parentElement;

    if (!parent) {
      return {
        container: null,
        siblingBlocks: [movableBlock]
      };
    }

    const siblingBlocks = [...parent.children].filter(sibling => {
      return scheduleTableCount(sibling) === 1;
    });

    return {
      container: parent,
      siblingBlocks
    };
  }

  function getSharedIdPrefix(elements) {
    const ids = elements
      .map(el => el.id)
      .filter(Boolean);

    if (ids.length < 2) return "";

    let prefix = ids[0];

    for (const id of ids.slice(1)) {
      while (!id.startsWith(prefix) && prefix.length > 0) {
        prefix = prefix.slice(0, -1);
      }
    }

    return prefix.replace(/\$\d*$/g, "");
  }

  function buildSelectorHint(el, siblings = []) {
    if (!el) return "";

    const sharedPrefix = getSharedIdPrefix(siblings);

    if (sharedPrefix) {
      return `[id^="${sharedPrefix}"]`;
    }

    if (el.id) {
      const prefix = el.id.replace(/\$\d+.*/g, "");
      return `[id^="${prefix}"]`;
    }

    if (el.classList.length > 0) {
      return "." + [...el.classList].join(".");
    }

    return el.tagName.toLowerCase();
  }

  function sanitizeElement(element, options = {}) {
    if (!element) return "";

    const clone = element.cloneNode(true);

    clone.querySelectorAll(
      "script, style, iframe, input, button, select, option, textarea, link, svg, img, .broncosort-rating"
    ).forEach(el => el.remove());

    clone.querySelectorAll("a").forEach(a => {
      a.removeAttribute("href");
      a.removeAttribute("onclick");
      a.removeAttribute("target");
      a.removeAttribute("rel");
    });

    clone.querySelectorAll("*").forEach(el => {
      const tag = el.tagName.toLowerCase();

      if (tag === "th") {
        el.textContent = el.textContent.replace(/\s+/g, " ").trim();
      } else if (tag === "td") {
        el.textContent = "[cell]";
      } else {
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = "";
          }
        });
      }

      const allowed = [
        "id",
        "name",
        "class",
        "role",
        "data-role",
        "aria-label",
        "scope",
        "colspan",
        "rowspan"
      ];

      [...el.attributes].forEach(attr => {
        if (!allowed.includes(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      });
    });

    const html = clone.outerHTML;

    if (options.maxLength && html.length > options.maxLength) {
      return html.slice(0, options.maxLength);
    }

    return html;
  }

  function getSignature(el) {
    if (!el) return "";

    const tag = el.tagName.toLowerCase();

    if (el.id) {
      return `${tag}#${el.id}`;
    }

    if (el.classList.length > 0) {
      return `${tag}.${[...el.classList].join(".")}`;
    }

    return tag;
  }

  const table = findBestTable();

  if (!table) {
    console.error("No schedule table found.");
    return;
  }

  const movableBlock = findMovableBlock(table);
  const groupInfo = findGroupContainer(movableBlock);

  const siblingBlocks = groupInfo.siblingBlocks || [];

  const packageData = {
    hostname: location.hostname,
    pathname: location.pathname,
    capturedAt: new Date().toISOString(),

    detection: {
      semantic: hasSemanticScheduleHeaders(table),
      fallback: hasFallbackSchedulePattern(table),
      headers: getHeaderTexts(table)
    },

    selectorHints: {
      tableSelector: buildSelectorHint(table),
      rowSelector: "tbody tr",
      movableBlockSelector: buildSelectorHint(movableBlock, siblingBlocks),
      groupContainerSelector: buildSelectorHint(groupInfo.container)
    },

    counts: {
      tableSize: table.outerHTML.length,
      movableBlockSize: movableBlock.outerHTML.length,
      groupContainerSize: groupInfo.container?.outerHTML.length || 0,
      siblingCount: siblingBlocks.length
    },

    skeletons: {
      table: sanitizeElement(table, { maxLength: 15000 }),
      movableBlock: sanitizeElement(movableBlock, { maxLength: 25000 }),
      groupContainerPreview: sanitizeElement(groupInfo.container, { maxLength: 35000 })
    },

    siblingSignatures: siblingBlocks.slice(0, 20).map(getSignature)
  };

  console.log("Collected schedule context:", packageData);

  const payload = JSON.stringify(packageData);

  if (payload.length > 90000) {
    console.error("Payload too large. Not sending.", payload.length);
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/collect/collectData", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("Backend error:", response.status, text);
      return;
    }

    try {
      console.log("Success:", JSON.parse(text));
    } catch {
      console.log("Success:", text);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

collectScheduleContext();