/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: schemas for every network resource: the raw GitHub Advisory, NVD, EPSS and Hacker News responses as they arrive, and the compact records the pen keeps from them.
import { z } from "zod";

/* ----------------------------------------
   Raw responses
   ---------------------------------------- */
export const ghsaAdvisorySchema = z.object({
  ghsa_id: z.string(),
  cve_id: z.string().nullable(),
  html_url: z.string(),
  summary: z.string(),
  type: z.string(),
  severity: z.string().nullable(),
  published_at: z.string(),
  withdrawn_at: z.string().nullable().optional(),
  cvss: z.object({ score: z.number().nullable() }).nullable().optional(),
  vulnerabilities: z
    .array(
      z.object({
        package: z
          .object({ ecosystem: z.string(), name: z.string().nullable() })
          .nullable(),
        vulnerable_version_range: z.string().nullable().optional(),
        first_patched_version: z.string().nullable().optional()
      })
    )
    .nullable()
});
export const ghsaPageSchema = z.array(ghsaAdvisorySchema);
export type GhsaAdvisory = z.infer<typeof ghsaAdvisorySchema>;

const cvssMetric = z.object({
  cvssData: z.object({ baseScore: z.number() })
});

export const nvdVulnerabilitySchema = z.object({
  cve: z.object({
    id: z.string(),
    published: z.string(),
    sourceIdentifier: z.string().optional(),
    vulnStatus: z.string().optional(),
    descriptions: z.array(z.object({ lang: z.string(), value: z.string() })),
    metrics: z
      .object({
        cvssMetricV40: z.array(cvssMetric).optional(),
        cvssMetricV31: z.array(cvssMetric).optional(),
        cvssMetricV30: z.array(cvssMetric).optional()
      })
      .optional(),
    cisaExploitAdd: z.string().optional(),
    cisaVulnerabilityName: z.string().optional(),
    cisaRequiredAction: z.string().optional(),
    cisaActionDue: z.string().optional(),
    configurations: z
      .array(
        z.object({
          nodes: z.array(
            z.object({
              cpeMatch: z.array(z.object({ criteria: z.string() })).optional()
            })
          )
        })
      )
      .optional()
  })
});
export const nvdPageSchema = z.object({
  totalResults: z.number(),
  startIndex: z.number(),
  resultsPerPage: z.number(),
  vulnerabilities: z.array(nvdVulnerabilitySchema)
});
export type NvdVulnerability = z.infer<typeof nvdVulnerabilitySchema>;

export const epssPageSchema = z.object({
  total: z.number(),
  offset: z.number(),
  data: z.array(z.object({ cve: z.string(), epss: z.string() }))
});

export const hnPageSchema = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string().nullable(),
      url: z.string().nullable().optional(),
      points: z.number().nullable(),
      num_comments: z.number().nullable().optional(),
      created_at: z.string()
    })
  )
});

/* ----------------------------------------
   Compact records the pen keeps
   ---------------------------------------- */
export const severitySchema = z.enum([
  "critical",
  "high",
  "moderate",
  "low",
  "unknown"
]);

export const advisorySchema = z.object({
  id: z.string(),
  cve: z.string().nullable(),
  title: z.string(),
  severity: severitySchema,
  cvss: z.number().nullable(),
  published: z.string(),
  source: z.enum(["ghsa", "nvd"]),
  stationIds: z.array(z.string()),
  vendor: z.string().nullable().optional(),
  products: z.array(z.string()),
  fixes: z.array(
    z.object({
      pkg: z.string(),
      affected: z.string().nullable(),
      patched: z.string().nullable()
    })
  ),
  url: z.string()
});
export type Advisory = z.infer<typeof advisorySchema>;

export const compromiseSchema = z.object({
  id: z.string(),
  stationId: z.string(),
  pkg: z.string(),
  published: z.string(),
  url: z.string()
});
export type Compromise = z.infer<typeof compromiseSchema>;

export const exploitationSchema = z.object({
  cve: z.string(),
  added: z.string(),
  published: z.string(),
  name: z.string(),
  stationIds: z.array(z.string()),
  vendor: z.string().nullable().optional(),
  products: z.array(z.string()),
  cvss: z.number().nullable(),
  action: z.string().nullable(),
  due: z.string().nullable(),
  url: z.string()
});
export type Exploitation = z.infer<typeof exploitationSchema>;

export const epssMapSchema = z.record(z.string(), z.number());
export type EpssMap = z.infer<typeof epssMapSchema>;

export const storySchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  discussion: z.string(),
  points: z.number(),
  comments: z.number(),
  published: z.string()
});
export type Story = z.infer<typeof storySchema>;
