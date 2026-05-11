(() => {
    function cleanText(text = "") {
        return text.replace(/\s+/g, " ").trim();
    }

    function isBadInstructor(text) {
        return !text || /to be announced|tba|staff|none|unknown/i.test(text);
    }

    function looksLikeName(text) {
        text = cleanText(text);
        if (isBadInstructor(text)) return false;
        if (text.length > 60) return false;

        return /^[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,4}$/.test(text);
    }

    function shortHTML(el, limit = 1200) {
        return el?.outerHTML?.replace(/\s+/g, " ").slice(0, limit) || null;
    }

    function getBestDoc() {
        const iframe =
            document.querySelector('iframe[name="TargetContent"]') ||
            document.querySelector("#ptifrmtgtframe") ||
            document.querySelector("iframe");

        try {
            if (iframe?.contentDocument) {
                return {
                    doc: iframe.contentDocument,
                    iframe: {
                        id: iframe.id || null,
                        name: iframe.name || null,
                        src: iframe.src || null
                    }
                };
            }
        } catch (e) { }

        return {
            doc: document,
            iframe: null
        };
    }

    function findPeopleSoftSections(doc) {
        const instructorEls = [...doc.querySelectorAll('[id^="MTG_INSTR"]')];

        return instructorEls
            .map((el) => {
                const section =
                    el.closest('[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]') ||
                    el.closest('[id*="SSR_CLSRSLT_WRK_GROUPBOX"]') ||
                    el.closest("tr") ||
                    el.parentElement;

                return {
                    text: cleanText(el.innerText),
                    instructorId: el.id || null,
                    sectionId: section?.id || null,
                    instructorHTML: shortHTML(el, 500),
                    sectionHTML: shortHTML(section, 1500)
                };
            })
            .filter((item) => !isBadInstructor(item.text));
    }

    function findGenericCandidates(doc) {
        const els = [...doc.querySelectorAll("td, span, div, a")];

        return els
            .filter((el) => looksLikeName(el.innerText))
            .map((el) => {
                const section =
                    el.closest("tr") ||
                    el.closest('[class*="section" i]') ||
                    el.closest('[class*="class" i]') ||
                    el.closest('[class*="course" i]') ||
                    el.parentElement;

                return {
                    text: cleanText(el.innerText),
                    tag: el.tagName,
                    id: el.id || null,
                    className: typeof el.className === "string" ? el.className : null,
                    sectionId: section?.id || null,
                    instructorHTML: shortHTML(el, 500),
                    sectionHTML: shortHTML(section, 1500)
                };
            })
            .slice(0, 100);
    }

    const { doc, iframe } = getBestDoc();

    const peopleSoftSections = findPeopleSoftSections(doc);
    const genericCandidates = findGenericCandidates(doc);

    const report = {
        url: location.href,
        title: document.title,
        detectedIframe: iframe,
        peopleSoftCompatible: peopleSoftSections.length > 0,
        selectors: {
            iframe: iframe ? 'iframe[name="TargetContent"], #ptifrmtgtframe' : null,
            instructor: peopleSoftSections.length > 0 ? '[id^="MTG_INSTR"]' : "generic name scan",
            section:
                peopleSoftSections.length > 0
                    ? '[id^="win0divSSR_CLSRSLT_WRK_GROUPBOX2$"]'
                    : "closest tr / section / class / course container"
        },
        peopleSoftSections,
        genericCandidates
    };

    console.log(report);
    copy(JSON.stringify(report, null, 2));
    console.log("Copied compatibility report to clipboard.");
})();