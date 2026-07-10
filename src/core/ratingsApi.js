// src/core/ratingsApi.js

(function () {
  window.BroncoSort = window.BroncoSort || {};
  window.BroncoSort.core = window.BroncoSort.core || {};

  const USE_LOCAL_API = true;
  const API_BASE = USE_LOCAL_API
    ? "http://localhost:3000"
    : "https://broncosort.onrender.com";

  const pendingRequests = new Map();

  async function fetchJson(response) {
    try {
      return await response.json();
    } catch {
      throw new Error("BroncoSort backend returned invalid JSON.");
    }
  }

  async function wakeServer() {
    try {
      await fetch(`${API_BASE}/api/health`, { method: "GET" });
    } catch (error) {
      console.warn("BroncoSort could not wake backend:", error);
    }
  }

  async function fetchProfessorRatings({ school, professors }) {
    const uniqueProfessors = [...new Set(professors || [])].filter(Boolean);

    if (!school || uniqueProfessors.length === 0) {
      return {};
    }

    const requestKey = JSON.stringify({
      school,
      professors: uniqueProfessors.slice().sort(),
    });

    if (pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey);
    }

    const request = fetch(`${API_BASE}/api/professor/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        school,
        professors: uniqueProfessors,
      }),
    })
      .then(async (response) => {
        const data = await fetchJson(response);

        if (!response.ok) {
          const error = new Error(
            data?.error || `BroncoSort backend error: ${response.status}`,
          );
          error.status = response.status;
          throw error;
        }

        return data?.ratingsByName || {};
      })
      .finally(() => {
        pendingRequests.delete(requestKey);
      });

    pendingRequests.set(requestKey, request);
    return request;
  }

  window.BroncoSort.core.ratingsApi = {
    API_BASE,
    wakeServer,
    fetchProfessorRatings,
  };
})();
