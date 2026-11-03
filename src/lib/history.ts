import { db } from "@/lib/db";
import type { LeadStatus, SavedLead } from "@/lib/pipeline";

/**
 * Per-user persistence. Every query is filtered by the user id from the server-side session —
 * callers never pass a user id that came from the browser.
 */

type LeadRow = {
  lead_id: string;
  name: string;
  website: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  opportunity: number | null;
  verdict: SavedLead["verdict"];
  missing: string[];
  status: LeadStatus;
  notes: string;
  saved_at: string;
  updated_at: string;
};

const toLead = (r: LeadRow): SavedLead => ({
  id: r.lead_id,
  name: r.name,
  website: r.website,
  phone: r.phone,
  address: r.address,
  category: r.category,
  opportunity: r.opportunity,
  verdict: r.verdict,
  missing: r.missing ?? [],
  status: r.status,
  notes: r.notes,
  savedAt: new Date(r.saved_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

export async function listLeads(userId: string): Promise<SavedLead[]> {
  const rows = (await db()`
    select lead_id, name, website, phone, address, category, opportunity, verdict, missing, status, notes, saved_at, updated_at
    from saved_leads where user_id = ${userId} order by updated_at desc limit 1000`) as LeadRow[];
  return rows.map(toLead);
}

/** Insert or refresh a lead's business details, keeping the user's own status and notes. */
export async function upsertLead(userId: string, l: SavedLead): Promise<void> {
  await db()`
    insert into saved_leads (user_id, lead_id, name, website, phone, address, category, opportunity, verdict, missing, status, notes)
    values (${userId}, ${l.id}, ${l.name}, ${l.website}, ${l.phone}, ${l.address}, ${l.category}, ${l.opportunity}, ${l.verdict}, ${l.missing}, ${l.status}, ${l.notes})
    on conflict (user_id, lead_id) do update set
      name = excluded.name, website = excluded.website, phone = excluded.phone, address = excluded.address,
      category = excluded.category,
      opportunity = coalesce(excluded.opportunity, saved_leads.opportunity),
      verdict = coalesce(excluded.verdict, saved_leads.verdict),
      missing = case when excluded.opportunity is null then saved_leads.missing else excluded.missing end,
      updated_at = now()`;
}

/** Bulk import (e.g. leads saved in the browser before signing in). Existing rows win. */
export async function importLeads(userId: string, leads: SavedLead[]): Promise<number> {
  let added = 0;
  for (const l of leads.slice(0, 500)) {
    const rows = (await db()`
      insert into saved_leads (user_id, lead_id, name, website, phone, address, category, opportunity, verdict, missing, status, notes, saved_at)
      values (${userId}, ${l.id}, ${l.name}, ${l.website}, ${l.phone}, ${l.address}, ${l.category}, ${l.opportunity}, ${l.verdict}, ${l.missing}, ${l.status}, ${l.notes}, ${new Date(l.savedAt).toISOString()})
      on conflict (user_id, lead_id) do nothing returning lead_id`) as unknown[];
    added += rows.length;
  }
  return added;
}

export async function updateLead(userId: string, leadId: string, patch: { status?: LeadStatus; notes?: string }) {
  await db()`
    update saved_leads set
      status = coalesce(${patch.status ?? null}, status),
      notes = coalesce(${patch.notes ?? null}, notes),
      updated_at = now()
    where user_id = ${userId} and lead_id = ${leadId}`;
}

export async function removeLead(userId: string, leadId: string) {
  await db()`delete from saved_leads where user_id = ${userId} and lead_id = ${leadId}`;
}

export type SearchEntry = {
  id: number;
  city: string;
  niche: string;
  radiusM: number;
  placeLabel: string | null;
  resultCount: number;
  createdAt: number;
};

export async function recordSearch(
  userId: string,
  s: { city: string; niche: string; radiusM: number; placeLabel: string | null; resultCount: number },
) {
  await db()`
    insert into search_history (user_id, city, niche, radius_m, place_label, result_count)
    values (${userId}, ${s.city}, ${s.niche}, ${s.radiusM}, ${s.placeLabel}, ${s.resultCount})`;
}

export async function listSearches(userId: string, limit = 100): Promise<SearchEntry[]> {
  const rows = (await db()`
    select id, city, niche, radius_m, place_label, result_count, created_at
    from search_history where user_id = ${userId} order by created_at desc limit ${limit}`) as Array<{
    id: string | number;
    city: string;
    niche: string;
    radius_m: number;
    place_label: string | null;
    result_count: number;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: Number(r.id),
    city: r.city,
    niche: r.niche,
    radiusM: r.radius_m,
    placeLabel: r.place_label,
    resultCount: r.result_count,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export type AuditEntry = {
  id: number;
  leadId: string;
  businessName: string;
  url: string | null;
  opportunity: number;
  verdict: "prime" | "warm" | "saturated";
  missing: string[];
  createdAt: number;
};

export async function recordAudit(
  userId: string,
  a: { leadId: string; businessName: string; url: string | null; opportunity: number; verdict: AuditEntry["verdict"]; missing: string[] },
) {
  await db()`
    insert into audit_history (user_id, lead_id, business_name, url, opportunity, verdict, missing)
    values (${userId}, ${a.leadId}, ${a.businessName}, ${a.url}, ${a.opportunity}, ${a.verdict}, ${a.missing.slice(0, 20)})`;
}

export async function listAudits(userId: string, limit = 200): Promise<AuditEntry[]> {
  const rows = (await db()`
    select id, lead_id, business_name, url, opportunity, verdict, missing, created_at
    from audit_history where user_id = ${userId} order by created_at desc limit ${limit}`) as Array<{
    id: string | number;
    lead_id: string;
    business_name: string;
    url: string | null;
    opportunity: number;
    verdict: AuditEntry["verdict"];
    missing: string[];
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: Number(r.id),
    leadId: r.lead_id,
    businessName: r.business_name,
    url: r.url,
    opportunity: r.opportunity,
    verdict: r.verdict,
    missing: r.missing ?? [],
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function clearHistory(userId: string, kind: "searches" | "audits") {
  if (kind === "searches") await db()`delete from search_history where user_id = ${userId}`;
  else await db()`delete from audit_history where user_id = ${userId}`;
}
