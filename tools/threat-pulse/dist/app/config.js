/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
export const catchAll = {
  id: "unassigned",
  name: "Unassigned",
  kind: "platform",
  newsTerms: [],
  catchAll: true
};
export const stations = [{
  id: "npm",
  name: "npm",
  kind: "ecosystem",
  ghsa: ["npm"],
  newsTerms: ["npm", "node.js", "nodejs", "javascript package"]
}, {
  id: "pypi",
  name: "PyPI",
  kind: "ecosystem",
  ghsa: ["pip"],
  newsTerms: ["pypi", "python package", "pip "]
}, {
  id: "maven",
  name: "Maven Central",
  kind: "ecosystem",
  ghsa: ["maven"],
  newsTerms: ["maven", "java library", "log4j", "spring"]
}, {
  id: "go",
  name: "Go modules",
  kind: "ecosystem",
  ghsa: ["go"],
  newsTerms: ["golang", "go module", "go package"]
}, {
  id: "crates",
  name: "crates.io",
  kind: "ecosystem",
  ghsa: ["rust"],
  newsTerms: ["crates.io", "rust crate", "cargo"]
}, {
  id: "nuget",
  name: "NuGet",
  kind: "ecosystem",
  ghsa: ["nuget"],
  newsTerms: ["nuget", ".net package"]
}, {
  id: "rubygems",
  name: "RubyGems",
  kind: "ecosystem",
  ghsa: ["rubygems"],
  newsTerms: ["rubygems", "ruby gem", "rails"]
}, {
  id: "packagist",
  name: "Packagist",
  kind: "ecosystem",
  ghsa: ["composer"],
  newsTerms: ["packagist", "composer", "php package", "laravel"]
}, {
  id: "actions",
  name: "GitHub Actions",
  kind: "ecosystem",
  ghsa: ["actions"],
  newsTerms: ["github actions", "github action", "workflow", "ci/cd"]
}, {
  id: "hex-pub-swift",
  name: "Hex, Pub & SwiftPM",
  kind: "ecosystem",
  ghsa: ["erlang", "pub", "swift"],
  newsTerms: ["hex.pm", "elixir", "dart package", "swift package"]
}, {
  id: "edge",
  name: "Edge & VPN appliances",
  kind: "platform",
  vendors: ["fortinet", "ivanti", "paloaltonetworks", "citrix", "cisco", "sonicwall", "f5", "juniper", "checkpoint", "zyxel", "sophos", "watchguard", "pulsesecure", "arraynetworks", "barracuda", "netscaler", "sangfor"],
  newsTerms: ["fortinet", "fortigate", "ivanti", "palo alto", "pan-os", "citrix", "netscaler", "cisco", "sonicwall", "vpn", "firewall", "juniper", "f5 big-ip", "zyxel"]
}, {
  id: "microsoft",
  name: "Microsoft",
  kind: "platform",
  vendors: ["microsoft"],
  newsTerms: ["microsoft", "windows", "exchange", "sharepoint", "outlook", "azure", "patch tuesday"]
}, {
  id: "apple",
  name: "Apple",
  kind: "platform",
  vendors: ["apple"],
  newsTerms: ["apple", "ios", "macos", "iphone", "safari", "webkit"]
}, {
  id: "google",
  name: "Google, Chrome & Android",
  kind: "platform",
  vendors: ["google", "android"],
  newsTerms: ["chrome", "chromium", "android", "google"]
}, {
  id: "oss-infra",
  name: "Linux & open-source infrastructure",
  kind: "platform",
  vendors: ["linux", "redhat", "debian", "canonical", "suse", "openssl", "apache", "nginx", "gnu", "haxx", "sudo_project", "openbsd", "isc", "exim", "samba", "openssh", "kubernetes", "postgresql", "redis"],
  newsTerms: ["linux", "kernel", "openssl", "openssh", "apache", "nginx", "kubernetes", "glibc", "xz", "sudo", "curl"]
}, {
  id: "enterprise",
  name: "Enterprise software",
  kind: "platform",
  vendors: ["oracle", "sap", "vmware", "broadcom", "adobe", "ibm", "progress", "solarwinds", "veeam", "fortra", "crushftp", "connectwise", "kaseya", "servicenow", "salesforce"],
  newsTerms: ["oracle", "sap", "vmware", "esxi", "moveit", "solarwinds", "veeam", "connectwise", "kaseya", "goanywhere", "crushftp", "adobe"]
}, {
  id: "devtools",
  name: "Developer & CI tooling",
  kind: "platform",
  vendors: ["jenkins", "gitlab", "jetbrains", "atlassian", "docker", "hashicorp", "sonatype", "jfrog"],
  newsTerms: ["jenkins", "gitlab", "teamcity", "jetbrains", "confluence", "jira", "bitbucket", "docker", "terraform", "vs code", "ide extension"]
}, {
  id: "routers-iot",
  name: "Routers, cameras & IoT",
  kind: "platform",
  vendors: ["dlink", "d-link", "tp-link", "netgear", "linksys", "tenda", "totolink", "draytek", "hikvision", "dahua", "ubiquiti", "mikrotik", "asus"],
  newsTerms: ["router", "botnet", "d-link", "tp-link", "netgear", "mikrotik", "draytek", "iot", "camera", "nas"]
}, catchAll];
export const scoring = {
  severityWeight: {
    critical: 4,
    high: 2,
    moderate: 1,
    low: 0.5,
    unknown: 0.5
  },
  epssBoost: 6,
  epssFloor: 0.02,
  exploitedWeight: 12,
  recentDays: 14,
  baselineWeeks: 12,
  baselineFloor: 3,
  unusualRatio: 1.6,
  compromiseDays: 7,
  halfLifeDays: 2.5,
  minBaselineWeeks: 8,
  driverShare: 0.3,
  driverMinimum: 3
};
export const spans = [{
  id: "16w",
  weeks: 16
}, {
  id: "1y",
  weeks: 52
}, {
  id: "2y",
  weeks: 104
}];
/* ----------------------------------------
   Live feeds
   ---------------------------------------- */
export const feeds = {
  github: {
    base: "https://api.github.com/advisories",
    perPage: 100,
    reviewedPageCap: 8,
    malwarePageCap: 3,
    malwareWeeks: 1,
    reserve: 4,
    concurrency: 2,
    closeAfterDays: 3
  },
  nvd: {
    base: "https://services.nvd.nist.gov/rest/json/cves/2.0",
    resultsPerPage: 2000,
    spacingMs: 6500,
    maxRangeDays: 120,
    cacheTag: "v3",
    closeAfterDays: 21
  },
  epss: {
    base: "https://api.first.org/data/v1/epss",
    cutoff: 0.1,
    pageSize: 10000
  },
  news: {
    base: "https://hn.algolia.com/api/v1/search_by_date",
    queries: ["CVE", "vulnerability", "exploited", "zero-day", "malware", "ransomware", "supply chain", "malicious package", "breach"],
    minPoints: 4,
    hitsPerPage: 1000
  },
  freshForMs: 30 * 60 * 1000,
  snapshotForMs: 12 * 60 * 60 * 1000,
  cacheVersion: 2
};
/* ----------------------------------------
   Reading settings
   ---------------------------------------- */
export const reading = {
  locale: "en-US",
  timeZone: "UTC",
  focusEventLimit: 8,
  focusNewsLimit: 5,
  wireLimit: 160,
  swarmLimit: 300,
  vendorLimit: 15
};