import { z } from "zod";
import type { AnalysisReport, Business } from "./types";

export const STATUSES = ["new", "contacted", "won", "lost"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  won: "Won",
  lost: "Lost",
};

export const SavedLeadSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  website: z.string().max(2048).nullable(),
  phone: z.string().max(64).nullable(),
  address: z.string().max(300).nullable(),
  category: z.string().max(80).nullable(),
  opportunity: z.number().int().min(0).max(100).nullable(),
  verdict: z.enum(["prime", "warm", "saturated"]).nullable(),
  missing: z.array(z.string().max(60)).max(20),
  status: z.enum(STATUSES),
  notes: z.string().max(2000),
  savedAt: z.number(),
  updatedAt: z.number(),
});

export type SavedLead = z.infer<typeof SavedLeadSchema>;

const StoreSchema = z.object({ version: z.literal(1), leads: z.array(z.unknown()).max(1000) });

export const STORAGE_KEY = "salecrawler:pipeline:v1";

/**
 * Parse stored data defensively: localStorage can be edited by the user or other scripts, so treat
 * it as untrusted input. Invalid entries are dropped individually instead of wiping everything.
 */
export function parseStore(raw: string | null): SavedLead[] {
  if (!raw) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  const store = StoreSchema.safeParse(json);
  if (!store.success) return [];
  const out: SavedLead[] = [];
  const seen = new Set<string>();
  for (const item of store.data.leads) {
    const lead = SavedLeadSchema.safeParse(item);
    if (lead.success && !seen.has(lead.data.id)) {
      seen.add(lead.data.id);
      out.push(lead.data);
    }
  }
  return out;
}

export function serializeStore(leads: SavedLead[]): string {
  return JSON.stringify({ version: 1, leads });
}

export function toSavedLead(b: Business, report: AnalysisReport | null, now = Date.now()): SavedLead {
  return {
    id: b.id,
    name: b.name.slice(0, 200),
    website: b.website,
    phone: b.phone,
    address: b.address,
    category: b.category,
    opportunity: report?.opportunity ?? null,
    verdict: report?.verdict ?? null,
    missing: report ? report.signals.filter((s) => !s.passed).map((s) => s.label).slice(0, 20) : [],
    status: "new",
    notes: "",
    savedAt: now,
    updatedAt: now,
  };
}
