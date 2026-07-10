// src/core/premiumProfessorPopup.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  let premiumPopupCloseTimer = null;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getInitials(name) {
    return String(name || "?")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function getStars(rating) {
    const value = Number(rating);

    if (!Number.isFinite(value)) {
      return Array.from(
        { length: 5 },
        () => '<span class="bs-empty-star">\u2605</span>',
      ).join("");
    }

    const rounded = Math.round(value);
    let stars = "";

    for (let index = 0; index < 5; index += 1) {
      stars +=
        index < rounded
          ? "\u2605"
          : '<span class="bs-empty-star">\u2605</span>';
    }

    return stars;
  }

  function showPremiumPopup({ professor, doc, anchorEl }) {
    if (!doc || !anchorEl) return;

    clearTimeout(premiumPopupCloseTimer);
    doc.querySelector(".bs-prof-popup")?.remove();

    const popup = doc.createElement("div");
    popup.className = "bs-prof-popup";

    const found = professor?.found !== false && Boolean(professor);
    const reviews = Number(professor?.numRatings || 0);
    const hasReviews = found && reviews > 0;
    const rating = hasReviews ? Number(professor.rating) : "N/A";
    const difficulty = hasReviews ? (professor.difficulty ?? "N/A") : "N/A";
    const takeAgain =
      hasReviews &&
      professor?.percentTakeAgain != null &&
      professor.percentTakeAgain >= 0
        ? `${Math.round(professor.percentTakeAgain)}%`
        : "N/A";

    const ranking = hasReviews ? professor?.ranking : null;
    const topPercent = ranking?.topPercent ?? null;
    const departmentRank = ranking?.rank ?? null;
    const departmentTotal = ranking?.departmentTotal ?? null;
    const rankingBadge =
      topPercent != null && departmentRank != null && departmentTotal != null
        ? `Top ${topPercent}% • Ranked #${departmentRank} of ${departmentTotal} professors`
        : topPercent != null
          ? `Top ${topPercent}%`
          : departmentRank != null && departmentTotal != null
            ? `Ranked #${departmentRank}/${departmentTotal}`
            : "Ranking coming soon";

    const ratingPercent = Number.isFinite(Number(rating))
      ? Math.min((Number(rating) / 5) * 100, 100)
      : 0;
    const difficultyPercent = Number.isFinite(Number(difficulty))
      ? Math.min((Number(difficulty) / 5) * 100, 100)
      : 0;
    const takeAgainPercent =
      takeAgain !== "N/A" ? Math.min(parseInt(takeAgain, 10), 100) : 0;

    const professorName =
      professor?.profName || professor?.name || "Unknown professor";
    const department = professor?.department || "Department unavailable";

    popup.innerHTML = `
      <div class="bs-popup-header">
        <div class="bs-popup-avatar">${escapeHTML(getInitials(professorName))}</div>
        <div class="bs-popup-person">
          <div class="bs-popup-name">${escapeHTML(professorName)}</div>
          <div class="bs-popup-department">${escapeHTML(department)}</div>
          <div class="bs-popup-rank-line">${escapeHTML(rankingBadge)}</div>
        </div>
        <div class="bs-rmp-label">RMP</div>
      </div>

      <div class="bs-popup-body">
        <div class="bs-popup-stats">
          <div class="bs-popup-stat">
            <div class="bs-stat-icon">\u2605</div>
            <div class="bs-popup-stat-label">Rating</div>
            <div class="bs-popup-stat-value">${escapeHTML(rating)}<span>/5</span></div>
            <div class="bs-bar"><div style="width: ${ratingPercent}%"></div></div>
          </div>
          <div class="bs-popup-stat">
            <div class="bs-stat-icon">!</div>
            <div class="bs-popup-stat-label">Difficulty</div>
            <div class="bs-popup-stat-value">${escapeHTML(difficulty)}<span>/5</span></div>
            <div class="bs-bar"><div style="width: ${difficultyPercent}%"></div></div>
          </div>
          <div class="bs-popup-stat">
            <div class="bs-stat-icon">%</div>
            <div class="bs-popup-stat-label">Take Again</div>
            <div class="bs-popup-stat-value">${escapeHTML(takeAgain)}</div>
            <div class="bs-bar"><div style="width: ${takeAgainPercent}%"></div></div>
          </div>
        </div>

        <div class="bs-popup-reviews">
          <div class="bs-popup-stars">${getStars(rating)}</div>
          <div>${
            !found
              ? "Not found on RateMyProfessors"
              : hasReviews
                ? `Based on <strong>${reviews}</strong> student reviews`
                : "No student reviews yet"
          }</div>
        </div>

        <div class="bs-popup-premium-actions">
          <button class="bs-popup-secondary-button" type="button" data-bs-action="grade-graph">
            Grade Graph
          </button>
          <button class="bs-popup-secondary-button" type="button" data-bs-action="ai-summary">
            AI Summary
          </button>
        </div>

        ${
          professor?.id
            ? `<a class="bs-popup-button" href="https://www.ratemyprofessors.com/professor/${encodeURIComponent(
                professor.id,
              )}" target="_blank" rel="noopener noreferrer">View Full Profile</a>`
            : ""
        }

        <div class="bs-popup-footer">
          <span class="bs-live-dot"></span>
          Live data
        </div>
      </div>
    `;

    doc.body.appendChild(popup);

    popup
      .querySelector('[data-bs-action="grade-graph"]')
      ?.addEventListener("click", () => {
        window.BroncoSort.core.gradeGraphPopup?.show?.({ professor, doc });
      });

    popup
      .querySelector('[data-bs-action="ai-summary"]')
      ?.addEventListener("click", () => {
        window.BroncoSort.core.aiSummaryPopup?.show?.({ professor, doc });
      });

    popup.style.position = "fixed";

    const targetRect = anchorEl.getBoundingClientRect();
    const win = doc.defaultView || window;
    const popupRect = popup.getBoundingClientRect();
    const viewportPadding = 12;
    const anchorGap = 8;
    let top = targetRect.bottom + anchorGap;
    let left = targetRect.left;

    if (top + popupRect.height > win.innerHeight - viewportPadding) {
      top = targetRect.top - popupRect.height - anchorGap;
    }

    if (left + popupRect.width > win.innerWidth - viewportPadding) {
      left = win.innerWidth - popupRect.width - viewportPadding;
    }

    if (left < viewportPadding) {
      left = viewportPadding;
    }

    const maxTop = Math.max(viewportPadding, win.innerHeight - popupRect.height - viewportPadding);
    top = Math.min(Math.max(viewportPadding, top), maxTop);

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    popup.addEventListener("pointerenter", () => {
      clearTimeout(premiumPopupCloseTimer);
    });

    popup.addEventListener("pointerleave", () => {
      premiumPopupCloseTimer = setTimeout(() => popup.remove(), 300);
    });
  }

  function closePremiumPopup(doc) {
    (doc || document).querySelector(".bs-prof-popup")?.remove();
  }

  window.BroncoSort.core.premiumPopup = {
    escapeHTML,
    getInitials,
    getStars,
    showPremiumPopup,
    closePremiumPopup,
  };
})();
