// src/config/schools.js

(function () {
  window.BroncoSort = window.BroncoSort || {};

  const schools = [
    {
      id: "cpp",
      displayName: "Cal Poly Pomona",
      apiSchoolName: "Cal Poly Pomona",
      domains: ["cmsweb.cms.cpp.edu", "cpp.edu"],
      adapters: ["cpp-peoplesoft", "cpp-schedule-builder"],
      features: {
        courseSearch: true,
        scheduleBuilder: true,
        sorting: true,
      },
    },
    {
      id: "citrus",
      displayName: "Citrus College",
      apiSchoolName: "Citrus College",
      domains: ["ssb.citruscollege.edu", "citruscollege.edu"],
      adapters: ["citrus-registration"],
      features: {
        courseSearch: true,
        scheduleBuilder: false,
        sorting: false,
      },
    },
  ];

  function hostnameMatchesDomain(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
  }

  function findSchoolByHostname(hostname) {
    const normalizedHostname = String(hostname || "").toLowerCase();

    if (
      (normalizedHostname === "localhost" ||
        normalizedHostname === "127.0.0.1") &&
      document.querySelector(
        'meta[name="broncosort-test-fixture"][content="citrus-registration"]',
      )
    ) {
      return schools.find((school) => school.id === "citrus") || null;
    }

    return (
      schools.find((school) =>
        school.domains.some((domain) =>
          hostnameMatchesDomain(normalizedHostname, domain),
        ),
      ) || null
    );
  }

  window.BroncoSort.config = {
    schools,
    findSchoolByHostname,
  };
})();
