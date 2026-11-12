// Raven Guard jobs board data.
// Edit this file to add, change or close roles. The careers page renders from it.
// Fields: id (stable, used in the application email subject), title, practice
// (Engineering | AI | Leadership | Security), type (Full-time | Contract | Fractional),
// location, posted (YYYY-MM-DD), open (true/false), summary, responsibilities[], requirements[].

window.RG_JOBS = [
  {
    id: "ENG-001",
    title: "Senior Platform Engineer",
    practice: "Engineering",
    type: "Full-time",
    location: "Remote, US",
    posted: "2026-11-12",
    open: true,
    summary: "Embed with client teams to build delivery pipelines, split monoliths and stand up the infrastructure they will own after we leave.",
    responsibilities: [
      "Lead platform and CI work inside a client team, on their tools and cadence",
      "Write the architecture decision records and the runbooks that go with them",
      "Review code daily and raise the bar without slowing the team",
      "Hand over cleanly: documentation, successor, and a working on-call rota"
    ],
    requirements: [
      "Eight or more years shipping backend or platform systems in production",
      "Deep experience with at least one major cloud and infrastructure as code",
      "Comfortable joining an unfamiliar codebase and being useful in week one",
      "Clear written communication; our weekly client update is a written document"
    ]
  },
  {
    id: "SEC-001",
    title: "Security Engineer, Detection and Response",
    practice: "Security",
    type: "Full-time",
    location: "Remote, US",
    posted: "2026-11-12",
    open: true,
    summary: "Run exposure assessments, threat hunts and incident investigations for clients, and close the findings in pull requests rather than spreadsheets.",
    responsibilities: [
      "Lead external exposure and OSINT assessments and write the graded report",
      "Work incidents end to end: triage, investigation, containment, recovery, lessons",
      "Tune detection logic and vulnerability management pipelines in client environments",
      "Pair with client engineers so fixes land in code, not in a backlog"
    ],
    requirements: [
      "Five or more years in security engineering, incident response or threat hunting",
      "Hands-on with SIEM, EDR and log investigation at scale",
      "Able to read and write code; most findings end in a pull request",
      "One of CISSP, OSCP, GCIH or equivalent experience"
    ]
  },
  {
    id: "AI-001",
    title: "AI Engineer, Agents and Evaluation",
    practice: "AI",
    type: "Contract",
    location: "Remote, US",
    posted: "2026-11-12",
    open: true,
    summary: "Build production agents and copilots for clients, with the evaluation harness, cost tracking and rollback plan that make them safe to ship.",
    responsibilities: [
      "Design and build agent workflows over client systems with governed read and write actions",
      "Stand up evaluation harnesses: prompt libraries, expected-point grading, baselines and trends",
      "Run load tests and model comparisons and write the selection memo",
      "Curate grounding datasets and tuning records so the agent answers from client knowledge"
    ],
    requirements: [
      "Shipped at least one model-backed feature to real users and know where it failed",
      "Strong Python; comfortable with TypeScript in a Next.js front end",
      "Experience with retrieval, evaluation and observability for LLM systems",
      "Skeptical by default; measures before claiming"
    ]
  },
  {
    id: "ENG-002",
    title: "Test Automation Engineer, Enterprise Platforms",
    practice: "Engineering",
    type: "Contract",
    location: "Remote, US",
    posted: "2026-11-12",
    open: true,
    summary: "Build end-to-end regression suites for ServiceNow, Salesforce and similar platforms, with locators that survive upgrades and runs wired into CI.",
    responsibilities: [
      "Record, generate and maintain Playwright and Robot Framework suites for client platforms",
      "Convert legacy Selenium, ATF and Playwright scripts into one maintained framework",
      "Wire runs into CI with a report per run and a clear owner for every failure",
      "Teach client QA teams to keep the suite alive after handover"
    ],
    requirements: [
      "Four or more years in test automation on enterprise web applications",
      "Playwright or Selenium fluency; Robot Framework a plus",
      "Working knowledge of ServiceNow or Salesforce UI and data model",
      "Patience for flaky tests and the discipline to fix the cause"
    ]
  },
  {
    id: "LEAD-001",
    title: "Fractional Engineering Leader",
    practice: "Leadership",
    type: "Fractional",
    location: "Remote, US, some travel",
    posted: "2026-11-12",
    open: true,
    summary: "Serve as interim CTO or VP Engineering for clients between leaders, two to three days a week, with a successor plan from the first week.",
    responsibilities: [
      "Set up the operating cadence: planning, review and incident rituals with the templates to run them",
      "Own hiring loops, levelling and team structure for the engagement",
      "Coach first-time engineering managers and the incoming permanent leader",
      "Deliver executive and board reporting with numbers the client can challenge"
    ],
    requirements: [
      "Led engineering organisations of thirty or more people as a director or above",
      "Has hired, levelled and, when needed, exited engineers",
      "Credible with founders and boards; comfortable saying no with a reason",
      "Still reads code"
    ]
  }
];
