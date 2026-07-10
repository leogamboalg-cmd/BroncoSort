// src/core/ratingRenderer.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  function createRatingText(doc, ratingInfo, options) {
    const fragment = doc.createDocumentFragment();
    const rating = Number(ratingInfo?.rating || 0);
    const numRatings = Number(ratingInfo?.numRatings || 0);

    if (!ratingInfo || ratingInfo.found === false) {
      fragment.append("Not found");
      return fragment;
    }

    if (numRatings <= 0) {
      fragment.append("No reviews");
      return fragment;
    }

    const star = doc.createElement("span");
    star.className = "broncosort-rating-star";
    star.style.fontSize = options.starSize || "17px";
    star.textContent = "\u2605";

    fragment.append(star, ` ${rating}${numRatings ? ` (${numRatings})` : ""}`);
    return fragment;
  }

  function removeExistingRating(option) {
    const parent = option.instrEl?.parentElement || option.block;

    if (!parent) return;

    const professorKey =
      window.BroncoSort.core.professorNames.normalizeProfessorName(option.name);

    Array.from(parent.querySelectorAll(".broncosort-rating")).forEach(
      (element) => {
        if (element.dataset.professorKey === professorKey) {
          element.remove();
        }
      },
    );
  }

  function createRatingElement({ option, ratingInfo, doc, rendererOptions }) {
    const tag = rendererOptions.ratingTag || "div";
    const ratingEl = doc.createElement(tag);

    ratingEl.className = [
      "broncosort-rating",
      rendererOptions.ratingClass || "",
    ]
      .filter(Boolean)
      .join(" ");
    const professorKey =
      window.BroncoSort.core.professorNames.normalizeProfessorName(option.name);
    ratingEl.dataset.professor = option.name;
    ratingEl.dataset.professorKey = professorKey;
    ratingEl.title = "Professor details";

    const professorId = ratingInfo?.id;
    const ratingContent = createRatingText(doc, ratingInfo, rendererOptions);

    if (professorId) {
      const link = doc.createElement("a");
      link.href = `https://www.ratemyprofessors.com/professor/${professorId}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(ratingContent);
      ratingEl.appendChild(link);
    } else {
      ratingEl.appendChild(ratingContent);
    }

    let closeTimer = null;

    ratingEl.addEventListener("pointerenter", (event) => {
      clearTimeout(closeTimer);
      const popupModule =
        window.BroncoSort.core.premiumProfessorPopup ||
        window.BroncoSort.core.professorPopup;
      const showPopup =
        popupModule.showPremiumPopup || popupModule.showProfessorPopup;

      showPopup({
        professor: {
          name: option.name,
          department: option.department,
          ...ratingInfo,
        },
        doc,
        anchorEl: event.currentTarget,
      });
    });

    ratingEl.addEventListener("pointerleave", () => {
      closeTimer = setTimeout(() => {
        const popup = doc.querySelector(".bs-premium-popup, .bs-prof-popup");

        if (!popup || !popup.matches(":hover")) {
          popup?.remove();
        }
      }, 300);
    });

    return ratingEl;
  }

  function reconnectInstructorElement(option) {
    if (option.instrEl?.isConnected !== false) return true;
    if (!option.block) return false;

    const normalize =
      window.BroncoSort.core.professorNames.normalizeProfessorName;
    const professorKey = normalize(option.name);
    const candidates = Array.from(
      option.block.querySelectorAll('[id^="MTG_INSTR"], a.email'),
    );
    const match = candidates.find((element) => {
      return (
        normalize(element.textContent || element.innerText || "") ===
        professorKey
      );
    });

    if (!match) return false;

    option.instrEl = match;
    return true;
  }

  function renderRating({ option, ratingInfo, adapter, doc, context }) {
    if (!option?.instrEl) return null;
    if (!reconnectInstructorElement(option)) return null;

    removeExistingRating(option);

    const rendererOptions = adapter.ratingRenderer || {};
    const ratingElement = createRatingElement({
      option,
      ratingInfo,
      doc,
      rendererOptions,
    });

    if (typeof adapter.insertRating === "function") {
      adapter.insertRating({
        option,
        ratingElement,
        doc,
        context,
      });
    } else {
      option.instrEl.insertAdjacentElement("afterend", ratingElement);
    }

    return ratingElement;
  }

  window.BroncoSort.core.ratingRenderer = {
    renderRating,
    removeExistingRating,
  };
})();
