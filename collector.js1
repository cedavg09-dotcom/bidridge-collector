require("dotenv").config();
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, ".collector_cache.json");
let COLLECTOR_CACHE = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    COLLECTOR_CACHE = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  }
} catch {
  COLLECTOR_CACHE = {};
}

function saveCollectorCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(COLLECTOR_CACHE, null, 2));
  } catch {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || SUPABASE_SECRET_KEY.includes("PASTE_")) {
  console.error("\nMissing Supabase settings.");
  console.error("Open .env and paste your Supabase Secret API key, then run again.\n");
  process.exit(1);
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; RoofingSignalCollector/4.0; +Texas procurement research)",
  "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
};

const STRONG_ROOF_TERMS = [
  ["roof replacement", 100],
  ["roofing replacement", 100],
  ["reroof", 100],
  ["re-roof", 100],
  ["roofing", 95],
  ["roof repair", 95],
  ["roof restoration", 95],
  ["roof renovation", 95],
  ["commercial roof", 95],
  ["tpo", 95],
  ["epdm", 95],
  ["pvc roofing", 95],
  ["roof membrane", 95],
  ["standing seam", 90],
  ["modified bitumen", 95],
  ["built-up roofing", 95],
  ["roof coating", 90],
  ["metal roof", 90],
  ["shingle roof", 85],
  ["tile roof", 85]
];

const EXCLUSION_TERMS = [
  "bridge deck", "abutment", "bent cap", "riprap", "pavement",
  "roadway", "traffic control", "lane expansion", "highway",
  "culvert", "deck repair", "deck soffit", "substructure",
  "guardrail", "striping", "asphalt pavement", "concrete pavement"
];

const BUILDING_CANDIDATE_TERMS = [
  "building renovation","building improvements","facility renovation","facility improvements",
  "facilities improvements","facility repair","facilities repair","campus renovation",
  "campus improvements","school renovation","school improvements","administration building",
  "maintenance facility","capital improvements","exterior renovation","envelope renovation",
  "building envelope","water intrusion","weatherproofing","construction renovation",
  "general construction"
];

const BROAD_EXCLUSION_TERMS = [
  "software","medical equipment","vehicle","food service","janitorial supplies",
  "office supplies","consulting services","professional services","insurance services",
  "telecommunications","computer equipment","cybersecurity","training services"
];

function buildingCandidateScore(textInput) {
  const text = String(textInput || "").toLowerCase();

  if (BROAD_EXCLUSION_TERMS.some(term => text.includes(term))) return 0;
  if (EXCLUSION_TERMS.some(term => text.includes(term))) return 0;

  let score = 0;
  for (const term of BUILDING_CANDIDATE_TERMS) {
    if (text.includes(term)) score += 20;
  }

  if (/\b(building|facility|facilities|school|campus)\b/.test(text)) score += 15;
  if (/\b(renovation|repair|improvement|construction)\b/.test(text)) score += 15;

  return Math.min(100, score);
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function roofingScore(textInput) {
  const text = String(textInput || "").toLowerCase();
  const strong = STRONG_ROOF_TERMS.filter(([term]) => text.includes(term));
  if (strong.length === 0) return 0;

  let score = Math.max(...strong.map(([, pts]) => pts));
  if (EXCLUSION_TERMS.some(term => text.includes(term))) score = Math.min(score, 55);
  return Math.max(0, Math.min(100, score));
}

function dateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const mdY = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdY) {
    const [,m,d,y] = mdY;
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  return null;
}

function hashId(input) {
  return Buffer.from(String(input)).toString("base64url").slice(0, 48);
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra
  };
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: supabaseHeaders()
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase GET ${res.status}: ${body}`);
  }
  return await res.json();
}

async function sbPost(table, body, prefer = "return=representation") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: prefer }),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase POST ${table} ${res.status}: ${text}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

async function sbPatch(table, query, body, prefer = "return=representation") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: supabaseHeaders({ Prefer: prefer }),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase PATCH ${table} ${res.status}: ${text}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

async function sbDelete(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: supabaseHeaders({ Prefer: "return=minimal" })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase DELETE ${table} ${res.status}: ${text}`);
  }
}

function escEq(value) {
  return encodeURIComponent(String(value ?? ""));
}

async function ensureSource(o) {
  const name = clean(o.source || "Unknown Source");
  const baseUrl = o.source_url || null;

  const found = await sbGet(
    `sources?select=*&name=eq.${escEq(name)}&limit=1`
  );
  if (found.length) {
    await sbPatch(
      "sources",
      `id=eq.${escEq(found[0].id)}`,
      {
        last_successful_collection_at: new Date().toISOString(),
        last_collection_status: "success",
        updated_at: new Date().toISOString()
      },
      "return=minimal"
    );
    return found[0];
  }

  const platform =
    /ionwave/i.test(name) ? "IonWave" :
    /bonfire|euna/i.test(name) ? "Bonfire/Euna" :
    /esbd|smartbuy/i.test(name) ? "Texas SmartBuy" :
    /txdot/i.test(name) ? "Socrata/TxDOT" :
    "Public Web";

  const rows = await sbPost("sources", {
    name,
    source_type: "procurement_portal",
    base_url: baseUrl,
    platform,
    jurisdiction: "Texas",
    is_active: true,
    collection_method: "collector",
    last_successful_collection_at: new Date().toISOString(),
    last_collection_status: "success"
  });
  return rows[0];
}

async function ensureOrganization(o) {
  const name = clean(o.agency || o.issuer || "Unknown Organization");

  const found = await sbGet(
    `organizations?select=*&name=eq.${escEq(name)}&limit=1`
  );
  if (found.length) return found[0];

  const rows = await sbPost("organizations", {
    name,
    organization_type: "public_owner",
    city: o.city || null,
    state: o.state || "TX",
    website_url: o.source_url || null
  });
  return rows[0];
}

function normalizedProjectTitle(o) {
  return clean(o.title || "Untitled Roofing Project").slice(0, 500);
}

function normalizeProjectIdentityTitle(value) {
  return clean(value || "")
    .toLowerCase()
    .replace(/\b(rfp|rfq|ifb|csp|rfb|csb)\s*#?\s*[a-z0-9.-]+\b/gi, " ")
    .replace(/\b(project|solicitation|bid)\s*(no\.?|number|#)?\s*[a-z0-9.-]+\b/gi, " ")
    .replace(/\b(addendum|rebid|re-bid)\s*#?\s*\d+\b/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROJECT_IDENTITY_STOPWORDS = new Set([
  "the","and","or","for","of","to","a","an","services","service","supplies",
  "project","projects","district","independent","school","city","county",
  "texas","tx","construction","contract","annual"
]);

function projectIdentityTokens(value) {
  return normalizeProjectIdentityTitle(value)
    .split(" ")
    .filter(x => x.length >= 3 && !PROJECT_IDENTITY_STOPWORDS.has(x));
}

function projectIdentitySimilarity(a, b) {
  const A = new Set(projectIdentityTokens(a));
  const B = new Set(projectIdentityTokens(b));
  if (!A.size || !B.size) return 0;

  let intersection = 0;
  for (const x of A) if (B.has(x)) intersection++;

  const union = new Set([...A, ...B]).size;
  const jaccard = union ? intersection / union : 0;
  const containment = intersection / Math.min(A.size, B.size);

  // Containment helps when one source adds "RFP #..." or extra procurement wording.
  return Math.max(jaccard, containment * 0.92);
}

function sameLocationEnough(o, p) {
  if (o.state && p.state && String(o.state).toUpperCase() !== String(p.state).toUpperCase()) return false;
  if (o.city && p.city && clean(o.city).toLowerCase() !== clean(p.city).toLowerCase()) return false;
  return true;
}

async function findExistingProject(o, org) {
  const title = normalizedProjectTitle(o);

  // 1) Exact title + city.
  let path = `projects?select=*&canonical_title=eq.${escEq(title)}`;
  if (o.city) path += `&city=eq.${escEq(o.city)}`;
  path += "&limit=1";

  let rows = await sbGet(path);
  if (rows.length) return { project: rows[0], match_type: "exact_title_city", score: 1 };

  // 2) Exact title + owner.
  if (org?.id) {
    rows = await sbGet(
      `projects?select=*&canonical_title=eq.${escEq(title)}&owner_organization_id=eq.${escEq(org.id)}&limit=1`
    );
    if (rows.length) return { project: rows[0], match_type: "exact_title_owner", score: 1 };
  }

  // 3) Same solicitation number already linked to a project.
  if (o.solicitation_number) {
    const solRows = await sbGet(
      `solicitations?select=project_id,solicitation_number&solicitation_number=eq.${escEq(o.solicitation_number)}&limit=1`
    );
    if (solRows.length && solRows[0].project_id) {
      const pRows = await sbGet(`projects?select=*&id=eq.${escEq(solRows[0].project_id)}&limit=1`);
      if (pRows.length) return { project: pRows[0], match_type: "solicitation_number", score: 1 };
    }
  }

  // 4) Intelligent same-owner comparison. Keep this conservative to avoid false merges.
  if (org?.id) {
    const candidates = await sbGet(
      `projects?select=*&owner_organization_id=eq.${escEq(org.id)}&order=last_updated_at.desc&limit=100`
    );

    let best = null;
    for (const candidate of candidates) {
      if (!sameLocationEnough(o, candidate)) continue;

      const score = projectIdentitySimilarity(title, candidate.canonical_title);
      if (!best || score > best.score) best = { project: candidate, score };
    }

    // 0.72 is intentionally conservative. Very high token overlap is required.
    if (best && best.score >= 0.72) {
      return { ...best, match_type: "title_similarity_owner" };
    }
  }

  return { project: null, match_type: "none", score: 0 };
}


function parseMoneyFromText(textInput) {
  const text = String(textInput || "");
  const patterns = [
    /(?:estimated\s+(?:construction\s+)?cost|estimated\s+value|project\s+budget|construction\s+budget|budget)\s*:?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\$\s*([\d,]{5,}(?:\.\d{1,2})?)/
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = Number(String(m[1]).replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function extractPostalCode(textInput) {
  const m = String(textInput || "").match(/\b(?:TX|Texas)\s+(\d{5})(?:-\d{4})?\b/i);
  return m ? m[1] : null;
}

function extractTexasCityFromText(textInput) {
  const text = String(textInput || "");
  const m = text.match(/(?:Project Address|Location|Site|Address)\s*:?\s*[^,\n]{0,150},\s*([A-Za-z .'-]{2,80}),\s*(?:TX|Texas)\b/i);
  return m ? clean(m[1]) : null;
}

function inferStatusFromText(textInput, deadline) {
  const text = String(textInput || "").toLowerCase();
  if (/\b(cancelled|canceled|withdrawn)\b/.test(text)) return "cancelled";
  if (/\bstatus\s*:\s*closed\b/.test(text) || /\bclosed solicitation\b/.test(text)) return "closed";
  if (/\bawarded\b/.test(text) && !/\bnot awarded\b/.test(text)) return "awarded";
  if (deadline) {
    const d = new Date(`${deadline}T23:59:59`);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return "closed";
  }
  return "active";
}

function enrichNormalizedOpportunity(o) {
  const description = clean(o.description || o.rawText || "").slice(0, 10000);
  return {
    ...o,
    description,
    city: o.city || extractTexasCityFromText(description) || null,
    state: o.state || "TX",
    postal_code: o.postal_code || extractPostalCode(description),
    estimated_value:
      Number(o.estimated_value || o.value || 0) ||
      parseMoneyFromText(description) ||
      null,
    status:
      o.status && o.status !== "active"
        ? o.status
        : inferStatusFromText(description, o.deadline)
  };
}

function projectDataQuality(o) {
  let score = 0;
  const flags = [];
  if (o.title) score += 20; else flags.push("missing_title");
  if (o.agency || o.issuer) score += 15; else flags.push("missing_agency");
  if (o.city) score += 10; else flags.push("missing_city");
  if (o.deadline || o.expected_bid_date) score += 15; else flags.push("missing_bid_date");
  if (o.solicitation_number) score += 10; else flags.push("missing_solicitation_number");
  if (o.source_url) score += 10; else flags.push("missing_source_url");
  if (Number(o.roofing_relevance || 0) >= 80) score += 10; else flags.push("low_roofing_relevance");
  if ((o.description || "").length >= 80) score += 10; else flags.push("thin_description");
  return { score, flags };
}

function deriveBidStatus(o) {
  if (o.status === "planned") return "planned";
  if (o.status === "cancelled") return "cancelled";
  if (o.status === "closed") return "closed";
  if (o.deadline) {
    const d = new Date(`${o.deadline}T23:59:59`);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return "closed";
  }
  return "open";
}

function projectLifecycleFor(o) {
  const status = deriveBidStatus(o);
  if (status === "planned") return "pre_bid";
  if (status === "open") return "bidding";
  if (status === "cancelled") return "cancelled";
  return "completed";
}

async function ingestOpportunity(o) {
  o = enrichNormalizedOpportunity(o);
  const quality = projectDataQuality(o);

  const source = await ensureSource(o);
  const org = await ensureOrganization(o);

  const rawRows = await sbPost("raw_ingest", {
    source_id: source.id,
    source_record_id: o.solicitation_number || null,
    source_url: o.source_url || null,
    fetched_at: new Date().toISOString(),
    content_type: "normalized_collector_record",
    raw_json: {
      ...o,
      data_quality_score: quality.score,
      data_quality_flags: quality.flags
    },
    processing_status: "new"
  });
  const raw = rawRows[0];

  if (Number(o.roofing_relevance || 0) < 80) {
    await sbPatch(
      "raw_ingest",
      `id=eq.${escEq(raw.id)}`,
      {
        processing_status: "rejected",
        rejection_reason: "roofing_relevance_below_80"
      },
      "return=minimal"
    );
    return { saved: false, reason: "low_relevance" };
  }

  const title = normalizedProjectTitle(o);
  const match = await findExistingProject(o, org);
  let project = match.project;
  let isNewProject = false;
  const previousStage = project?.lifecycle_stage || null;
  const previousStatus = project?.status || null;

  if (!project) {
    const rows = await sbPost("projects", {
      canonical_title: title,
      description: o.description || null,
      lifecycle_stage: projectLifecycleFor(o),
      roofing_relevance: Number(o.roofing_relevance || 0),
      roofing_scope_summary: o.project_type || null,
      project_type: o.project_type || "Roofing",
      owner_organization_id: org.id,
      city: o.city || null,
      state: o.state || "TX",
      postal_code: o.postal_code || null,
      estimated_value: Number(o.estimated_value || o.value || 0) || null,
      earliest_known_date: o.posted_date || o.expected_bid_date || null,
      expected_bid_date: o.expected_bid_date || o.deadline || null,
      last_verified_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      status: ["open","planned"].includes(deriveBidStatus(o)) ? "active" : deriveBidStatus(o) === "cancelled" ? "cancelled" : "closed",
      confidence: Math.max(50, Math.min(100, Math.round((Number(o.roofing_relevance || 50) + quality.score) / 2)))
    });
    project = rows[0];
    isNewProject = true;
  } else {
    await sbPatch(
      "projects",
      `id=eq.${escEq(project.id)}`,
      {
        canonical_title:
          normalizeProjectIdentityTitle(title).length > normalizeProjectIdentityTitle(project.canonical_title || "").length
            ? title
            : project.canonical_title,
        description:
          (o.description || "").length > (project.description || "").length
            ? o.description
            : project.description,
        roofing_relevance: Math.max(
          Number(project.roofing_relevance || 0),
          Number(o.roofing_relevance || 0)
        ),
        roofing_scope_summary: o.project_type || project.roofing_scope_summary,
        project_type: o.project_type || project.project_type,
        city: project.city || o.city || null,
        postal_code: project.postal_code || o.postal_code || null,
        expected_bid_date: o.expected_bid_date || o.deadline || project.expected_bid_date,
        estimated_value: Number(o.estimated_value || o.value || 0) || project.estimated_value,
        lifecycle_stage: projectLifecycleFor(o),
        status: ["open","planned"].includes(deriveBidStatus(o)) ? "active" : deriveBidStatus(o) === "cancelled" ? "cancelled" : "closed",
        last_verified_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      },
      "return=minimal"
    );
  }

  // Link the source to the project if it is not already linked.
  const sourceRecordId = o.solicitation_number || `${o.source}|${title}`;
  const existingLink = await sbGet(
    `project_sources?select=id&project_id=eq.${escEq(project.id)}&source_id=eq.${escEq(source.id)}&source_record_id=eq.${escEq(sourceRecordId)}&limit=1`
  );

  if (!existingLink.length) {
    await sbPost("project_sources", {
      project_id: project.id,
      source_id: source.id,
      source_record_id: sourceRecordId,
      source_url: o.source_url || null,
      source_title: title,
      source_excerpt: (o.description || "").slice(0, 2000),
      discovered_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      is_primary: true
    }, "return=minimal");
  } else {
    await sbPatch(
      "project_sources",
      `id=eq.${escEq(existingLink[0].id)}`,
      { last_seen_at: new Date().toISOString(), source_url: o.source_url || null },
      "return=minimal"
    );
  }

  // Create or update solicitation.
  const solicitationNumber = o.solicitation_number || sourceRecordId;
  const existingSol = await sbGet(
    `solicitations?select=*&project_id=eq.${escEq(project.id)}&solicitation_number=eq.${escEq(solicitationNumber)}&limit=1`
  );

  let solicitation;
  const solPayload = {
    project_id: project.id,
    source_id: source.id,
    issuing_organization_id: org.id,
    solicitation_number: solicitationNumber,
    title,
    description: o.description || null,
    notice_type: o.stage || "Solicitation",
    procurement_method: null,
    bid_status: deriveBidStatus(o),
    posted_date: o.posted_date || null,
    bid_deadline: o.deadline ? `${o.deadline}T23:59:59-05:00` : null,
    estimated_value: Number(o.estimated_value || o.value || 0) || null,
    official_url: o.source_url || null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_record_id: sourceRecordId
  };

  if (existingSol.length) {
    const rows = await sbPatch(
      "solicitations",
      `id=eq.${escEq(existingSol[0].id)}`,
      solPayload
    );
    solicitation = rows[0] || existingSol[0];
  } else {
    const rows = await sbPost("solicitations", solPayload);
    solicitation = rows[0];
  }

  // Timeline event only when a project or solicitation is first created.
  if (isNewProject || !existingSol.length) {
    await sbPost("project_events", {
      project_id: project.id,
      solicitation_id: solicitation?.id || null,
      source_id: source.id,
      event_type: isNewProject ? "project_discovered" : "solicitation_discovered",
      event_date: new Date().toISOString(),
      title: isNewProject ? "Project discovered" : "Solicitation discovered",
      description: `${title} discovered from ${source.name}`,
      source_url: o.source_url || null
    }, "return=minimal");
  }

  // Record lifecycle progression when an early signal becomes an open bid (or another meaningful stage change).
  const newStage = projectLifecycleFor(o);
  const newStatus = ["open","planned"].includes(deriveBidStatus(o))
    ? "active"
    : deriveBidStatus(o) === "cancelled"
      ? "cancelled"
      : "closed";

  if (!isNewProject && previousStage && previousStage !== newStage) {
    await sbPost("project_events", {
      project_id: project.id,
      solicitation_id: solicitation?.id || null,
      source_id: source.id,
      event_type: "lifecycle_stage_changed",
      event_date: new Date().toISOString(),
      title: `Project moved from ${previousStage} to ${newStage}`,
      description: `${title} was updated by ${source.name}`,
      old_value: { lifecycle_stage: previousStage, status: previousStatus },
      new_value: { lifecycle_stage: newStage, status: newStatus },
      source_url: o.source_url || null
    }, "return=minimal");
  }

  if (!isNewProject && match.match_type === "title_similarity_owner") {
    await sbPost("project_events", {
      project_id: project.id,
      solicitation_id: solicitation?.id || null,
      source_id: source.id,
      event_type: "source_linked_by_deduplication",
      event_date: new Date().toISOString(),
      title: "Additional source linked to existing project",
      description: `${title} matched the existing project "${project.canonical_title}" with similarity ${match.score.toFixed(2)}.`,
      new_value: { match_type: match.match_type, similarity: match.score },
      source_url: o.source_url || null
    }, "return=minimal");
  }

  await sbPatch(
    "raw_ingest",
    `id=eq.${escEq(raw.id)}`,
    {
      processing_status: "processed",
      linked_project_id: project.id,
      linked_solicitation_id: solicitation?.id || null
    },
    "return=minimal"
  );

  return {
    saved: true,
    project_id: project.id,
    solicitation_id: solicitation?.id || null,
    new_project: isNewProject,
    match_type: match.match_type,
    match_score: match.score
  };
}

// Compatibility alias so all existing collectors now feed the new pipeline.
async function saveOpportunity(o) {
  return await ingestOpportunity(o);
}

/* ---------------- SAM.gov ---------------- */

function samDate(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function samSearchDate(d) {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

async function collectSamGov() {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    console.log("\nSAM.gov skipped: SAM_GOV_API_KEY is not configured.");
    return 0;
  }

  console.log("\nSAM.gov Contract Opportunities");
  console.log("Downloading recent Texas federal opportunities...");

  const postedTo = new Date();
  const postedFrom = new Date(postedTo);
  postedFrom.setDate(postedFrom.getDate() - 365);

  const params = new URLSearchParams({
    api_key: apiKey,
    postedFrom: samSearchDate(postedFrom),
    postedTo: samSearchDate(postedTo),
    state: "TX",
    limit: "1000",
    offset: "0"
  });

  const response = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`, {
    headers: { Accept: "application/json", "User-Agent": HEADERS["User-Agent"] }
  });
  if (!response.ok) {
    const detail = clean(await response.text()).slice(0, 300);
    throw new Error(`SAM.gov request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const payload = await response.json();
  const opportunities = Array.isArray(payload.opportunitiesData) ? payload.opportunitiesData : [];
  console.log(`Downloaded ${opportunities.length} SAM.gov opportunities.`);

  let saved = 0;
  let roofingMatches = 0;
  for (const item of opportunities) {
    const place = item.placeOfPerformance || {};
    const city = clean(place.city?.name || place.city || "") || null;
    const state = clean(place.state?.code || place.state || "TX") || "TX";
    const description = clean([
      item.description,
      item.title,
      item.typeOfSetAsideDescription,
      item.classificationCode,
      item.naicsCode
    ].filter(Boolean).join(" | "));
    const relevance = roofingScore(description);
    if (relevance < 80) continue;
    roofingMatches += 1;

    const noticeId = clean(item.noticeId || "");
    const sourceUrl = clean(item.uiLink || item.additionalInfoLink || "") ||
      (noticeId ? `https://sam.gov/opp/${encodeURIComponent(noticeId)}/view` : "https://sam.gov/content/opportunities");
    const result = await saveOpportunity({
      title: clean(item.title || "Federal Roofing Opportunity").slice(0, 500),
      description: description || "Federal roofing contract opportunity",
      agency: clean(item.fullParentPathName || item.department || item.subTier || "U.S. Federal Government").slice(0, 500),
      city,
      state,
      postal_code: clean(place.zip || place.zipCode || "") || null,
      project_type: "Federal Roofing Solicitation",
      solicitation_number: clean(item.solicitationNumber || noticeId) || null,
      posted_date: samDate(item.postedDate),
      deadline: samDate(item.responseDeadLine || item.archiveDate),
      expected_bid_date: samDate(item.responseDeadLine || item.archiveDate),
      source: "SAM.gov Contract Opportunities",
      source_type: "federal_procurement",
      source_url: sourceUrl,
      stage: clean(item.type || item.baseType || "Solicitation"),
      status: "open",
      roofing_relevance: relevance
    });
    if (result?.saved) saved += 1;
  }

  console.log(`High-confidence roofing matches: ${roofingMatches}`);
  console.log(`SAM.gov saved/updated: ${saved}`);
  return saved;
}

/* ---------------- TxDOT ---------------- */

async function collectTxDot() {
  console.log("\n[1/2] TxDOT");
  console.log("Downloading up to 5,000 TxDOT projects...");

  const url = "https://data.texas.gov/resource/drau-zphx.json?$limit=5000";
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`TxDOT request failed (${res.status})`);

  const projects = await res.json();
  console.log(`Downloaded ${projects.length} TxDOT projects.`);

  const matches = projects.filter(p => roofingScore(JSON.stringify(p)) >= 80);
  console.log(`High-confidence roofing matches: ${matches.length}`);

  let saved = 0;
  for (const p of matches) {
    const title = clean(
      p.project_description || p.type_of_work || p.project_name || "TxDOT Roofing Opportunity"
    );
    const description = clean(p.type_of_work || p.project_description || "");
    const solicitation = clean(
      p.controlling_project_id_ccsj ||
      p.control_section_job_csj ||
      p.contract_number ||
      p.project_id ||
      ""
    );

    const amountRaw =
      p.engineers_estimate_amount || p.engineer_estimate || p.estimated_cost || null;
    const amount = amountRaw ? Number(String(amountRaw).replace(/[$,]/g,"")) : null;

    const opp = {
      title: title.slice(0,500),
      description: description || "Texas public construction project",
      agency: "Texas Department of Transportation",
      city: clean(p.city || p.municipality || "") || null,
      state: "TX",
      project_type: description.slice(0,300) || null,
      estimated_value: Number.isFinite(amount) ? amount : null,
      posted_date: dateOnly(p.posted_date || p.letting_date || p.created_date),
      deadline: dateOnly(p.bid_received_until_date_and || p.bid_date || p.letting_date),
      solicitation_number: solicitation || null,
      source: "TxDOT",
      source_url: "https://data.texas.gov/d/drau-zphx",
      roofing_relevance: roofingScore(JSON.stringify(p)),
      last_updated: new Date().toISOString()
    };

    await saveOpportunity(opp);
    saved++;
  }

  console.log(`TxDOT saved/updated: ${saved}`);
  return saved;
}

/* ---------------- ESBD ---------------- */

function parseLabelBlock(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*:\\s*([^\\n|]+)`, "i");
  const m = String(text).match(re);
  return m ? clean(m[1]) : null;
}

function absoluteEsbdUrl(href) {
  if (!href) return null;
  try {
    return new URL(href, "https://www.txsmartbuy.gov").toString();
  } catch {
    return null;
  }
}

async function fetchText(url, options = {}) {
  const {
    retries = 2,
    cacheTtlMs = 0,
    minimumDelayMs = 0
  } = options;

  const cached = COLLECTOR_CACHE[url];
  if (
    cacheTtlMs > 0 &&
    cached &&
    cached.text &&
    Date.now() - Number(cached.fetchedAt || 0) < cacheTtlMs
  ) {
    return cached.text;
  }

  if (minimumDelayMs > 0) await sleep(minimumDelayMs);

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: HEADERS, redirect: "follow" });

    if (res.ok) {
      const text = await res.text();
      if (cacheTtlMs > 0) {
        COLLECTOR_CACHE[url] = {
          fetchedAt: Date.now(),
          text
        };
        saveCollectorCache();
      }
      return text;
    }

    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30000, 5000 * Math.pow(2, attempt));

      console.log(`  Rate limited. Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${retries}...`);
      await sleep(waitMs);
      continue;
    }

    lastError = new Error(`${url} returned ${res.status}`);
    break;
  }

  // If a recently cached copy exists, prefer stale data over total source failure.
  if (cached && cached.text) {
    console.log(`  Using cached copy for ${url}`);
    return cached.text;
  }

  throw lastError || new Error(`${url} request failed`);
}

function parseEsbdListPage(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Solicitation detail links on ESBD are mixed with nav links. We inspect
  // every anchor and use the nearby text block to identify real solicitations.
  $("a").each((_, el) => {
    const a = $(el);
    const title = clean(a.text());
    const href = a.attr("href");
    if (!title || title.length < 4 || !href) return;

    // Walk up a few parents to capture the solicitation metadata displayed
    // beside the linked title.
    let node = a;
    let blockText = "";
    for (let i = 0; i < 5; i++) {
      node = node.parent();
      const t = clean(node.text());
      if (t.includes("Solicitation ID:") && t.includes("Due Date:")) {
        blockText = t;
        break;
      }
    }
    if (!blockText) return;

    const solicitationId = parseLabelBlock(blockText, "Solicitation ID");
    if (!solicitationId) return;

    results.push({
      title,
      solicitationId,
      dueDate: parseLabelBlock(blockText, "Due Date"),
      agencyNumber: parseLabelBlock(blockText, "Agency/Texas SmartBuy Member Number"),
      status: parseLabelBlock(blockText, "Status"),
      postingDate: parseLabelBlock(blockText, "Posting Date"),
      lastUpdated: parseLabelBlock(blockText, "Last Updated"),
      detailUrl: absoluteEsbdUrl(href),
      listText: blockText
    });
  });

  // Deduplicate list-page parse artifacts.
  const seen = new Set();
  return results.filter(r => {
    const k = r.solicitationId;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function enrichEsbd(item) {
  if (!item.detailUrl) return item;

  try {
    const html = await fetchText(item.detailUrl);
    const $ = cheerio.load(html);
    const body = clean($("body").text());

    // Try common labels from ESBD detail pages.
    const agency =
      parseLabelBlock(body, "Agency/Texas SmartBuy Member Name") ||
      parseLabelBlock(body, "Agency Name") ||
      (item.agencyNumber ? `Texas SmartBuy Member ${item.agencyNumber}` : "State of Texas");

    const description =
      parseLabelBlock(body, "Description") ||
      parseLabelBlock(body, "Solicitation Description") ||
      body.slice(0, 5000);

    return { ...item, detailText: body, agency, description };
  } catch (e) {
    return {
      ...item,
      agency: item.agencyNumber ? `Texas SmartBuy Member ${item.agencyNumber}` : "State of Texas",
      description: item.listText,
      detailError: e.message
    };
  }
}

async function collectEsbd() {
  console.log("\n[2/2] Texas ESBD");
  console.log("Scanning recent public ESBD solicitation pages...");

  // ~20 solicitations/page. 100 pages is roughly the latest 2,000 postings.
  const pagesToScan = Number(process.env.ESBD_PAGES || 100);
  const all = [];
  let pageFailures = 0;

  for (let page = 1; page <= pagesToScan; page++) {
    const url = page === 1
      ? "https://www.txsmartbuy.gov/esbd"
      : `https://www.txsmartbuy.gov/esbd?page=${page}`;

    try {
      const html = await fetchText(url);
      const parsed = parseEsbdListPage(html);
      all.push(...parsed);

      if (page === 1 || page % 10 === 0) {
        console.log(`  Scanned page ${page}/${pagesToScan} — ${all.length} solicitations seen`);
      }
    } catch (e) {
      pageFailures++;
      console.log(`  Page ${page} skipped: ${e.message}`);
      if (pageFailures >= 5) {
        console.log("  Too many ESBD page failures; stopping ESBD scan early.");
        break;
      }
    }
  }

  const seenIds = new Set();
  const unique = all.filter(x => {
    if (seenIds.has(x.solicitationId)) return false;
    seenIds.add(x.solicitationId);
    return true;
  });

  console.log(`Unique recent ESBD solicitations scanned: ${unique.length}`);

  // V5.1: inspect explicit roofing listings plus broader building/facilities listings.
  const explicitRoofing = unique.filter(item =>
    roofingScore(`${item.title} ${item.listText}`) >= 80
  );

  const broaderBuilding = unique.filter(item => {
    const text = `${item.title} ${item.listText}`;
    return roofingScore(text) < 80 && buildingCandidateScore(text) >= 30;
  });

  const candidateMap = new Map();
  for (const item of explicitRoofing) candidateMap.set(item.solicitationId, item);
  for (const item of broaderBuilding) candidateMap.set(item.solicitationId, item);
  const candidates = [...candidateMap.values()];

  console.log(`Explicit roofing candidates: ${explicitRoofing.length}`);
  console.log(`Broader building/facilities candidates: ${broaderBuilding.length}`);
  console.log(`Detail pages to inspect: ${candidates.length}`);

  let saved = 0;
  let failed = 0;
  let rejectedAfterDetail = 0;

  for (const item of candidates) {
    const enriched = await enrichEsbd(item);
    const combined = `${enriched.title} ${enriched.description || ""} ${enriched.detailText || ""}`;
    const score = roofingScore(combined);

    if (score < 80) {
      rejectedAfterDetail++;
      continue;
    }

    const opp = {
      title: enriched.title.slice(0,500),
      description: clean(enriched.description || enriched.listText).slice(0,10000),
      agency: clean(enriched.agency || "State of Texas").slice(0,500),
      city: null,
      state: "TX",
      project_type: "Roofing / Building Envelope",
      estimated_value: null,
      posted_date: dateOnly(enriched.postingDate),
      deadline: dateOnly(enriched.dueDate),
      solicitation_number: enriched.solicitationId,
      source: "Texas ESBD",
      source_url: enriched.detailUrl || "https://www.txsmartbuy.gov/esbd",
      roofing_relevance: score,
      last_updated: new Date().toISOString()
    };

    try {
      await saveOpportunity(opp);
      saved++;
      console.log(`✓ ESBD ${score} — ${opp.title}`);
    } catch (e) {
      failed++;
      console.log(`✗ ESBD — ${opp.title}`);
      console.log(`  ${e.message}`);
    }
  }

  console.log(`Rejected after detail review: ${rejectedAfterDetail}`);
  console.log(`ESBD saved/updated: ${saved}`);
  console.log(`ESBD failed: ${failed}`);
  return saved;
}


/* ---------------- Texas School District Aggregator ---------------- */

const TEXAS_SCHOOL_DISTRICTS = [
  {
    name: "Northside Independent School District",
    city: "San Antonio",
    urls: ["https://www.nisd.net/district/purchasing/business-with-nisd"]
  },
  {
    name: "North East Independent School District",
    city: "San Antonio",
    urls: ["https://www.neisd.net/subsites/Construction-Management--Engineering/Bids/index.html"]
  },
  {
    name: "San Antonio Independent School District",
    city: "San Antonio",
    urls: ["https://www.saisd.net/page/how-to-do-business-with-saisd"]
  },
  {
    name: "Judson Independent School District",
    city: "Converse",
    urls: ["https://jstem.judsonisd.org/o/jisd/page/bids-and-proposals-opportunities"]
  },
  {
    name: "Comal Independent School District",
    city: "New Braunfels",
    urls: ["https://www.comalisd.org/apps/pages/Purchasing"]
  },
  {
    name: "New Braunfels Independent School District",
    city: "New Braunfels",
    urls: ["https://nbisd.org/departments/business-office/#toc_Bidding_Opportunities"]
  }
];


const NON_OPPORTUNITY_TERMS = [
  "skip to main content",
  "elections",
  "board elections",
  "ballot initiatives",
  "insurance requirements",
  "supplier registration",
  "vendor registration",
  "tutorial",
  "how to register",
  "terms and conditions",
  "privacy policy",
  "accessibility",
  "contact us",
  "staff directory",
  "calendar",
  "news",
  "frequently asked questions",
  "faq",
  "small business program",
  "hub program requirements",
  "minority business",
  "procurement policy",
  "purchasing policy",
  "forms",
  "manual",
  "training"
];

const SOLICITATION_SIGNAL_TERMS = [
  "rfp","rfq","ifb","csp","rfb","bid #","bid no","solicitation",
  "proposal due","bids due","closing date","due date","project no",
  "project number","request for proposal","request for qualifications",
  "invitation for bid","competitive sealed proposal"
];

function isNonOpportunityText(textInput) {
  const t = String(textInput || "").toLowerCase();
  return NON_OPPORTUNITY_TERMS.some(term => t.includes(term));
}

function hasSolicitationSignal(textInput) {
  const t = String(textInput || "").toLowerCase();
  return SOLICITATION_SIGNAL_TERMS.some(term => t.includes(term));
}

function localRoofingSignal(title, context) {
  const titleScore = roofingScore(title || "");
  const contextScore = roofingScore(context || "");

  // Strongly prefer title-level roofing language. Otherwise require a real
  // solicitation signal in the same local block as the roofing text.
  if (titleScore >= 80) return titleScore;
  if (contextScore >= 80 && hasSolicitationSignal(context)) return contextScore;
  return 0;
}

const PROCUREMENT_LINK_TERMS = [
  "bid","bids","proposal","proposals","solicitation","solicitations","opportunity",
  "opportunities","construction","bond","vendor","procurement","ebid","e-bid",
  "ionwave","bonfire","opengov","current"
];

function isLikelyProcurementLink(text, href) {
  const hay = `${text || ""} ${href || ""}`.toLowerCase();
  return PROCUREMENT_LINK_TERMS.some(term => hay.includes(term));
}

function safeAbsoluteUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function extractSolicitationNumber(text) {
  const patterns = [
    /\b(?:CSP|RFP|RFQ|IFB|RFB|RFSQ|Bid)\s*#?\s*([A-Z0-9][A-Z0-9._/-]{3,})/i,
    /\b(?:Solicitation|Project)\s*(?:No\.?|Number|#)\s*:?\s*([A-Z0-9][A-Z0-9._/-]{3,})/i
  ];
  for (const p of patterns) {
    const m = String(text || "").match(p);
    if (m) return clean(m[0]);
  }
  return null;
}

function extractSchoolDueDate(text) {
  const patterns = [
    /(?:Closes?|Closing Date|Due Date|Proposals Due|Bids Due|Bid Date)\s*:?\s*(?:on\s*)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:Closes?|Closing Date|Due Date|Proposals Due|Bids Due|Bid Date)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
  ];
  for (const p of patterns) {
    const m = String(text || "").match(p);
    if (m) return dateOnly(m[1]);
  }
  return null;
}

function pageCandidates(html, pageUrl) {
  const $ = cheerio.load(html);
  const candidates = [];

  // Remove page chrome before evaluating candidate context.
  $("nav, footer, header, script, style, noscript").remove();

  $("a").each((_, el) => {
    const a = $(el);
    const title = clean(a.text());
    const href = a.attr("href");
    if (!title || !href || title.length < 4) return;
    if (isNonOpportunityText(title)) return;

    // Use the smallest nearby block that looks like a solicitation record.
    let node = a;
    let context = title;
    for (let i = 0; i < 4; i++) {
      node = node.parent();
      const t = clean(node.text());
      if (!t || t.length > 3000) continue;
      if (
        hasSolicitationSignal(t) ||
        roofingScore(t) >= 80 ||
        buildingCandidateScore(t) >= 30
      ) {
        context = t;
        break;
      }
    }

    if (isNonOpportunityText(context)) return;

    const url = safeAbsoluteUrl(href, pageUrl);
    const roof = localRoofingSignal(title, context);
    const building = buildingCandidateScore(`${title} ${context}`);

    // A candidate must look like an actual solicitation record. Generic
    // procurement/navigation links may still be followed elsewhere, but are
    // never saved as opportunities.
    const solicitationLike =
      hasSolicitationSignal(`${title} ${context}`) ||
      extractSolicitationNumber(`${title} ${context}`) ||
      extractSchoolDueDate(`${title} ${context}`);

    if ((roof >= 80 && solicitationLike) || (building >= 30 && solicitationLike)) {
      candidates.push({ title, context, url, pageUrl, roof, building, solicitationLike: true });
    }
  });

  return candidates;
}

async function fetchSchoolPage(url) {
  try {
    return await fetchText(url);
  } catch (e) {
    return null;
  }
}

async function collectOneSchoolDistrict(district) {
  const queue = [];
  const visited = new Set();
  const rawCandidates = [];

  for (const url of district.urls) queue.push({ url, depth: 0 });

  // Follow a limited number of procurement-related links so one district cannot
  // explode into a huge crawl.
  while (queue.length && visited.size < 25) {
    const current = queue.shift();
    if (!current?.url || visited.has(current.url)) continue;
    visited.add(current.url);

    const html = await fetchSchoolPage(current.url);
    if (!html) continue;

    const found = pageCandidates(html, current.url);
    rawCandidates.push(...found);

    if (current.depth < 1) {
      for (const c of found) {
        if (!c.url || visited.has(c.url)) continue;
        if (!isLikelyProcurementLink(c.title, c.url)) continue;
        queue.push({ url: c.url, depth: current.depth + 1 });
        if (queue.length > 30) break;
      }
    }
  }

  const uniqueCandidates = new Map();
  for (const c of rawCandidates) {
    const key = c.url || `${c.title}|${c.context}`;
    if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, c);
  }

  let explicit = 0;
  let broad = 0;
  let saved = 0;
  let rejected = 0;
  let failed = 0;

  for (const item of uniqueCandidates.values()) {
    if (item.roof >= 80) explicit++;
    else if (item.building >= 30) broad++;
    else continue;

    let detailText = item.context;
    if (item.url && !visited.has(`detail:${item.url}`)) {
      visited.add(`detail:${item.url}`);
      const html = await fetchSchoolPage(item.url);
      if (html) {
        const $ = cheerio.load(html);
        const bodyText = clean($("body").text());
        if (bodyText.length > detailText.length) detailText = bodyText;
      }
    }

    const combined = `${item.title} ${detailText}`;
    const solicitation = extractSolicitationNumber(combined);
    const due = extractSchoolDueDate(combined);
    const score = localRoofingSignal(item.title, detailText);

    if (
      score < 80 ||
      isNonOpportunityText(`${item.title} ${detailText}`) ||
      !(hasSolicitationSignal(combined) || solicitation || due)
    ) {
      rejected++;
      continue;
    }

    const opp = {
      title: clean(item.title).slice(0, 500) || `${district.name} Roofing Opportunity`,
      description: clean(detailText).slice(0, 10000),
      agency: district.name,
      city: district.city || null,
      state: "TX",
      project_type: "School Roofing / Facilities",
      estimated_value: null,
      posted_date: null,
      deadline: due,
      solicitation_number: solicitation,
      source: district.name,
      source_url: item.url || item.pageUrl,
      roofing_relevance: score,
      last_updated: new Date().toISOString()
    };

    try {
      await saveOpportunity(opp);
      saved++;
      console.log(`  ✓ ${district.name}: ${opp.title}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${district.name}: ${opp.title}`);
      console.log(`    ${e.message}`);
    }
  }

  return {
    district: district.name,
    pages: visited.size,
    candidates: uniqueCandidates.size,
    explicit,
    broad,
    rejected,
    saved,
    failed
  };
}

async function collectTexasSchools() {
  console.log("\n[3/3] Texas School District Aggregator");
  console.log(`Scanning ${TEXAS_SCHOOL_DISTRICTS.length} major Texas school districts...`);

  let totalSaved = 0;
  const results = [];

  for (let i = 0; i < TEXAS_SCHOOL_DISTRICTS.length; i++) {
    const district = TEXAS_SCHOOL_DISTRICTS[i];
    console.log(`\n  [${i + 1}/${TEXAS_SCHOOL_DISTRICTS.length}] ${district.name}`);

    try {
      const result = await collectOneSchoolDistrict(district);
      results.push(result);
      totalSaved += result.saved;
      console.log(
        `  pages=${result.pages} candidates=${result.candidates} explicit=${result.explicit} broad=${result.broad} saved=${result.saved}`
      );
    } catch (e) {
      console.log(`  District failed: ${e.message}`);
      results.push({ district: district.name, saved: 0, failed: 1 });
    }
  }

  console.log("\nSchool aggregator summary:");
  for (const r of results) {
    console.log(`  ${r.district}: saved ${r.saved || 0}`);
  }
  console.log(`Total school opportunities saved/updated: ${totalSaved}`);

  return totalSaved;
}


/* ---------------- Texas Master Public-Entity Aggregator ---------------- */

const TEXAS_PUBLIC_ENTITIES = [
  {type:"city", name:"City of San Antonio", city:"San Antonio", urls:["https://www.sa.gov/Directory/Departments/Finance/Procurement"]},
  {type:"county", name:"Bexar County", city:"San Antonio", urls:["https://www.bexar.org/581/Purchasing-Department"]},
  {type:"university", name:"Texas State University", city:"San Marcos", urls:["https://www.txst.edu/procurement.html"]},
  {type:"university", name:"UTSA", city:"San Antonio", urls:["https://www.utsa.edu/financialaffairs/services/purchasing/"]},
  {type:"authority", name:"San Antonio Housing Authority / Opportunity Home", city:"San Antonio", urls:["https://homesa.org/business/"]},
  {type:"college", name:"Alamo Colleges District", city:"San Antonio", urls:["https://www.alamo.edu/about-us/offices-departments/departments/purchasing/"]},
  {type:"city", name:"City of New Braunfels", city:"New Braunfels", urls:["https://www.newbraunfels.gov/531/Purchasing"]},
  {type:"city", name:"City of San Marcos", city:"San Marcos", urls:["https://sanmarcostx.gov/Bids.aspx"]},
  {type:"county", name:"Guadalupe County", city:"Seguin", urls:["https://www.guadalupetx.gov/page/purchasing.home"]},
  {type:"city", name:"City of Seguin", city:"Seguin", urls:["https://seguintexas.gov/181/Purchasing"]},
  {type:"city", name:"City of Kerrville", city:"Kerrville", urls:["https://www.kerrvilletx.gov/318/Purchasing"]}
];

const PORTAL_HOST_HINTS = [
  "ionwave.net","bonfirehub.com","opengov.com","bidnetdirect.com",
  "planetbids.com","publicpurchase.com","demandstar.com","bidsync.com",
  "procureware.com","negometrix.com","periscopeholdings.com"
];

function portalType(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("ionwave.net")) return "IonWave";
  if (u.includes("bonfirehub.com")) return "Bonfire";
  if (u.includes("opengov.com")) return "OpenGov";
  if (u.includes("bidnetdirect.com")) return "BidNet";
  if (u.includes("planetbids.com")) return "PlanetBids";
  if (u.includes("publicpurchase.com")) return "PublicPurchase";
  if (u.includes("demandstar.com")) return "DemandStar";
  if (u.includes("bidsync.com")) return "BidSync";
  return "Public Web";
}

function isPortalUrl(url) {
  const u = String(url || "").toLowerCase();
  return PORTAL_HOST_HINTS.some(h => u.includes(h));
}

function isSameOrProcurementDomain(url, seedUrl) {
  try {
    const a = new URL(url);
    const b = new URL(seedUrl);
    return a.hostname === b.hostname || isPortalUrl(url);
  } catch {
    return false;
  }
}

async function collectOnePublicEntity(entity) {
  const queue = entity.urls.map(url => ({url, depth:0, seed:url}));
  const visited = new Set();
  const candidateMap = new Map();
  const portalLinks = new Set();

  while (queue.length && visited.size < 35) {
    const cur = queue.shift();
    if (!cur?.url || visited.has(cur.url)) continue;
    visited.add(cur.url);

    const html = await fetchSchoolPage(cur.url);
    if (!html) continue;

    const found = pageCandidates(html, cur.url);
    for (const c of found) {
      const key = c.url || `${c.title}|${c.context}`;
      if (!candidateMap.has(key)) candidateMap.set(key, c);

      if (c.url && isPortalUrl(c.url)) portalLinks.add(c.url);

      if (
        cur.depth < 1 &&
        c.url &&
        !visited.has(c.url) &&
        isLikelyProcurementLink(c.title, c.url) &&
        isSameOrProcurementDomain(c.url, cur.seed)
      ) {
        queue.push({url:c.url, depth:cur.depth+1, seed:cur.seed});
      }
    }
  }

  let saved=0, rejected=0, failed=0, explicit=0, broad=0;

  for (const item of candidateMap.values()) {
    if (item.roof >= 80) explicit++;
    else if (item.building >= 30) broad++;
    else continue;

    let detailText=item.context;
    // Only fetch public HTML pages. We do not bypass logins, CAPTCHAs, or restricted portals.
    if (item.url && !isPortalUrl(item.url)) {
      const html=await fetchSchoolPage(item.url);
      if (html) {
        const $=cheerio.load(html);
        const body=clean($("body").text());
        if (body.length > detailText.length) detailText=body;
      }
    }

    const combined=`${item.title} ${detailText}`;
    const solicitation = extractSolicitationNumber(combined);
    const due = extractSchoolDueDate(combined);
    const score = localRoofingSignal(item.title, detailText);

    if (
      score < 80 ||
      isNonOpportunityText(`${item.title} ${detailText}`) ||
      !(hasSolicitationSignal(combined) || solicitation || due)
    ) {
      rejected++;
      continue;
    }

    const opp={
      title:clean(item.title).slice(0,500) || `${entity.name} Roofing Opportunity`,
      description:clean(detailText).slice(0,10000),
      agency:entity.name,
      city:entity.city || null,
      state:"TX",
      project_type:`${entity.type} Roofing / Facilities`,
      estimated_value:null,
      posted_date:null,
      deadline:due,
      solicitation_number:solicitation,
      source:entity.name,
      source_url:item.url || item.pageUrl,
      roofing_relevance:score,
      last_updated:new Date().toISOString()
    };

    try {
      await saveOpportunity(opp);
      saved++;
      console.log(`  ✓ ${entity.name}: ${opp.title}`);
    } catch(e) {
      failed++;
      console.log(`  ✗ ${entity.name}: ${opp.title}`);
      console.log(`    ${e.message}`);
    }
  }

  return {
    name:entity.name,
    type:entity.type,
    pages:visited.size,
    candidates:candidateMap.size,
    explicit,
    broad,
    rejected,
    saved,
    failed,
    portals:[...portalLinks].map(u=>portalType(u))
  };
}

async function collectTexasPublicEntities() {
  console.log("\n[4/4] Texas Master Public-Entity Aggregator");
  console.log(`Scanning ${TEXAS_PUBLIC_ENTITIES.length} cities, counties, universities, and public owners...`);

  let total=0;
  let worked=0;
  let portalDiscoveries=0;

  for (let i=0;i<TEXAS_PUBLIC_ENTITIES.length;i++) {
    const entity=TEXAS_PUBLIC_ENTITIES[i];
    console.log(`\n  [${i+1}/${TEXAS_PUBLIC_ENTITIES.length}] ${entity.name}`);

    try {
      const r=await collectOnePublicEntity(entity);
      total += r.saved;
      if (r.pages > 0) worked++;
      portalDiscoveries += r.portals.length;
      console.log(
        `  pages=${r.pages} candidates=${r.candidates} explicit=${r.explicit} broad=${r.broad} saved=${r.saved}` +
        (r.portals.length ? ` portals=${[...new Set(r.portals)].join(",")}` : "")
      );
    } catch(e) {
      console.log(`  Entity failed: ${e.message}`);
    }
  }

  console.log("\nMaster public-entity summary:");
  console.log(`  Entities with reachable public pages: ${worked}/${TEXAS_PUBLIC_ENTITIES.length}`);
  console.log(`  Procurement portal links discovered: ${portalDiscoveries}`);
  console.log(`  Roofing opportunities saved/updated: ${total}`);
  return total;
}


/* ---------------- Procurement Platform Connectors ---------------- */

const PLATFORM_REGISTRY = [
  // IonWave — public current-opportunity boards
  {
    platform: "IonWave",
    agency: "Houston Independent School District",
    city: "Houston",
    url: "https://houstonisd.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "Plano Independent School District",
    city: "Plano",
    url: "https://pisd.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "Coppell Independent School District",
    city: "Coppell",
    url: "https://coppellisd.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "Little Elm Independent School District",
    city: "Little Elm",
    url: "https://littleelmisd.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "City of Carrollton",
    city: "Carrollton",
    url: "https://carrolltonbids.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "City of Denton",
    city: "Denton",
    url: "https://dentontx.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "Region 18 Education Service Center",
    city: "Midland",
    url: "https://esc18.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "City of Irving",
    city: "Irving",
    url: "https://cityofirving.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "City of Arlington",
    city: "Arlington",
    url: "https://arlington-tx.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },
  {
    platform: "IonWave",
    agency: "Lewisville Independent School District",
    city: "Lewisville",
    url: "https://lisd.ionwave.net/SourcingEvents.aspx?SourceType=1"
  },

  // Bonfire — public portal/opportunity pages
  {
    platform: "Bonfire",
    agency: "Austin Independent School District",
    city: "Austin",
    url: "https://austinisd.bonfirehub.com/portal"
  },
  {
    platform: "Bonfire",
    agency: "Region 1 Education Service Center",
    city: "Edinburg",
    url: "https://esc1.bonfirehub.com/portal/?tab=openOpportunities"
  },
  {
    platform: "Bonfire",
    agency: "Region 5 Education Service Center",
    city: "Beaumont",
    url: "https://esc5.bonfirehub.com/portal/?tab=openOpportunities"
  },

  // OpenGov — currently probed/report-only unless public HTML becomes readable
  {
    platform: "OpenGov",
    agency: "Katy Independent School District",
    city: "Katy",
    url: "https://procurement.opengov.com/portal/katyisd"
  }
];

function parseIonWaveRows(html) {
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  function addRow(r) {
    const bidNumber = clean(r.bidNumber);
    const title = clean(r.title);
    if (!bidNumber || !title) return;
    if (/bid number/i.test(bidNumber) || /bid title/i.test(title)) return;
    const key = `${bidNumber}|${title}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      bidNumber,
      title,
      bidType: clean(r.bidType) || null,
      organization: clean(r.organization) || null,
      issueDate: clean(r.issueDate) || null,
      closeDate: clean(r.closeDate) || null,
      detailUrl: r.detailUrl || null,
      rawText: clean(r.rawText || "")
    });
  }

  $("tr").each((_, tr) => {
    const cells = $(tr).find("td").map((__, td) => clean($(td).text())).get();
    if (cells.length < 6) return;

    addRow({
      bidNumber: cells[0],
      title: cells[1],
      bidType: cells[2],
      organization: cells[3],
      issueDate: cells[4],
      closeDate: cells[5],
      rawText: cells.join(" | ")
    });
  });

  const textish = html
    .replace(/<\/(?:td|th)>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");

  const rowRegex = /([A-Z0-9][A-Z0-9._/-]{2,}(?:\s+Addendum\s+\d+)?)\s*\|\s*([^|]{4,300}?)\s*\|\s*([^|]{2,150}?)\s*\|\s*([^|]{0,150}?)\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\|\s*(\d{1,2}\/\d{1,2}\/\d{4}[^|]{0,60})/gi;
  let rm;
  while ((rm = rowRegex.exec(textish))) {
    addRow({
      bidNumber: rm[1],
      title: rm[2],
      bidType: rm[3],
      organization: rm[4],
      issueDate: rm[5],
      closeDate: rm[6],
      rawText: rm[0]
    });
  }

  return rows;
}

async function collectIonWaveBoard(entry) {
  const html = await fetchText(entry.url, { retries: 3, cacheTtlMs: 15 * 60 * 1000, minimumDelayMs: 1800 });
  const rows = parseIonWaveRows(html);
  console.log(`  Parsed ${rows.length} live bid rows from ${entry.agency}.`);

  let saved = 0;
  let rejected = 0;
  let failed = 0;

  for (const row of rows) {
    const combined = `${row.title} ${row.bidType || ""} ${row.organization || ""} ${row.rawText || ""}`;
    const score = roofingScore(combined);

    if (score < 80 || isNonOpportunityText(combined)) {
      rejected++;
      continue;
    }

    const opp = {
      title: row.title.slice(0,500),
      description: `${row.bidType || ""}${row.organization ? ` — ${row.organization}` : ""}`.trim(),
      agency: entry.agency,
      city: entry.city || null,
      state: "TX",
      project_type: "Roofing / Facilities",
      estimated_value: null,
      posted_date: dateOnly(row.issueDate),
      deadline: dateOnly(row.closeDate),
      solicitation_number: row.bidNumber,
      source: `${entry.agency} IonWave`,
      source_url: entry.url,
      roofing_relevance: score,
      last_updated: new Date().toISOString()
    };

    try {
      await saveOpportunity(opp);
      saved++;
      console.log(`  ✓ IonWave ${entry.agency}: ${opp.title}`);
    } catch(e) {
      failed++;
      console.log(`  ✗ IonWave ${entry.agency}: ${opp.title}`);
      console.log(`    ${e.message}`);
    }
  }

  return { rows: rows.length, saved, rejected, failed };
}

async function probePortal(entry) {
  try {
    const res = await fetch(entry.url, { headers: HEADERS, redirect: "follow" });
    const status = res.status;
    const html = await res.text();
    const text = clean(html).slice(0,3000);

    return {
      platform: entry.platform,
      agency: entry.agency,
      status,
      reachable: res.ok,
      looksBlocked: status === 401 || status === 403 || /login|sign in|captcha|access denied/i.test(text)
    };
  } catch(e) {
    return {
      platform: entry.platform,
      agency: entry.agency,
      status: null,
      reachable: false,
      looksBlocked: true,
      error: e.message
    };
  }
}


function parseBonfireProjects(html, portalUrl) {
  const $ = cheerio.load(html);
  const projects = [];
  const seen = new Set();

  function addProject(p) {
    const title = clean(p.title);
    if (!title || title.length < 4) return;
    if (isNonOpportunityText(title)) return;

    const key = `${clean(p.reference || "")}|${title}|${clean(p.deadline || "")}`;
    if (seen.has(key)) return;
    seen.add(key);

    projects.push({
      title,
      reference: clean(p.reference) || null,
      deadline: clean(p.deadline) || null,
      posted: clean(p.posted) || null,
      description: clean(p.description) || null,
      detailUrl: p.detailUrl || portalUrl,
      rawText: clean(p.rawText || "")
    });
  }

  // Strategy 1: visible project cards/rows.
  $("tr, article, li, .project, .opportunity, .card").each((_, el) => {
    const node = $(el);
    const text = clean(node.text());
    if (!text || text.length < 15 || text.length > 6000) return;

    const looksLikeOpportunity =
      hasSolicitationSignal(text) ||
      /\b(open|active|posted|closing|deadline|project)\b/i.test(text);

    if (!looksLikeOpportunity) return;

    const title =
      clean(node.find("h1,h2,h3,h4,strong,a").first().text()) ||
      text.slice(0, 250);

    let detailUrl = portalUrl;
    const a = node.find("a[href]").first();
    if (a.length) {
      try { detailUrl = new URL(a.attr("href"), portalUrl).toString(); } catch {}
    }

    addProject({
      title,
      reference: extractSolicitationNumber(text),
      deadline: extractSchoolDueDate(text),
      description: text,
      detailUrl,
      rawText: text
    });
  });

  // Strategy 2: inspect embedded JSON/state. Bonfire pages are often JS apps,
  // but some project metadata may be serialized into script tags.
  $("script").each((_, el) => {
    const txt = $(el).html() || "";
    if (!txt || txt.length < 20) return;

    // Find object-like snippets containing recognizable project keys.
    const candidates = [];
    const titleMatches = [...txt.matchAll(/"(?:projectName|ProjectName|title|Title|name|Name)"\s*:\s*"([^"]{4,300})"/g)];
    for (const m of titleMatches) {
      const pos = m.index || 0;
      const slice = txt.slice(Math.max(0,pos-1500), Math.min(txt.length,pos+2500));
      candidates.push({title:m[1], slice});
    }

    for (const c of candidates) {
      const ref =
        (c.slice.match(/"(?:referenceNumber|ReferenceNumber|projectCode|ProjectCode|solicitationNumber|SolicitationNumber)"\s*:\s*"([^"]+)"/) || [])[1] ||
        extractSolicitationNumber(c.slice);

      const deadline =
        (c.slice.match(/"(?:closeDate|CloseDate|closingDate|ClosingDate|deadline|Deadline)"\s*:\s*"([^"]+)"/) || [])[1] ||
        extractSchoolDueDate(c.slice);

      let detailUrl = portalUrl;
      const urlMatch = c.slice.match(/"(?:url|Url|projectUrl|ProjectUrl)"\s*:\s*"([^"]+)"/);
      if (urlMatch) {
        try { detailUrl = new URL(urlMatch[1].replace(/\\\//g,"/"), portalUrl).toString(); } catch {}
      }

      addProject({
        title:c.title,
        reference:ref,
        deadline,
        description:c.slice,
        detailUrl,
        rawText:c.slice
      });
    }
  });

  return projects;
}

async function collectBonfirePortal(entry) {
  const html = await fetchText(entry.url, { retries: 2, cacheTtlMs: 15 * 60 * 1000, minimumDelayMs: 1500 });
  const projects = parseBonfireProjects(html, entry.url);

  console.log(`  Parsed ${projects.length} Bonfire project candidates from ${entry.agency}.`);

  let saved = 0;
  let rejected = 0;
  let failed = 0;

  for (const project of projects) {
    let detailText = `${project.title} ${project.description || ""} ${project.rawText || ""}`;

    // Follow only publicly accessible Bonfire detail pages.
    if (project.detailUrl && project.detailUrl !== entry.url) {
      try {
        const detailHtml = await fetchText(project.detailUrl);
        const $ = cheerio.load(detailHtml);
        const body = clean($("body").text());
        if (body) detailText += ` ${body}`;
      } catch {}
    }

    const score = localRoofingSignal(project.title, detailText);
    const solicitation = project.reference || extractSolicitationNumber(detailText);
    const due = dateOnly(project.deadline) || extractSchoolDueDate(detailText);

    if (
      score < 80 ||
      isNonOpportunityText(detailText) ||
      !(hasSolicitationSignal(detailText) || solicitation || due)
    ) {
      rejected++;
      continue;
    }

    const opp = {
      title: project.title.slice(0,500),
      description: clean(detailText).slice(0,10000),
      agency: entry.agency,
      city: entry.city || null,
      state: "TX",
      project_type: "Roofing / Facilities",
      estimated_value: null,
      posted_date: dateOnly(project.posted),
      deadline: due,
      solicitation_number: solicitation,
      source: `${entry.agency} Bonfire`,
      source_url: project.detailUrl || entry.url,
      roofing_relevance: score,
      last_updated: new Date().toISOString()
    };

    try {
      await saveOpportunity(opp);
      saved++;
      console.log(`  ✓ Bonfire ${entry.agency}: ${opp.title}`);
    } catch(e) {
      failed++;
      console.log(`  ✗ Bonfire ${entry.agency}: ${opp.title}`);
      console.log(`    ${e.message}`);
    }
  }

  return { projects:projects.length, saved, rejected, failed };
}

async function collectProcurementPlatforms() {
  console.log("\n[5/5] Procurement Platform Connectors");
  console.log(`Checking ${PLATFORM_REGISTRY.length} seeded procurement portals...`);
  const ionwaveCount = PLATFORM_REGISTRY.filter(x=>x.platform==="IonWave").length;
  const bonfireCount = PLATFORM_REGISTRY.filter(x=>x.platform==="Bonfire").length;
  const openGovCount = PLATFORM_REGISTRY.filter(x=>x.platform==="OpenGov").length;
  console.log(`  IonWave=${ionwaveCount} Bonfire=${bonfireCount} OpenGov=${openGovCount}`);

  let totalSaved = 0;
  let ionwaveBoards = 0;
  const blocked = [];

  for (const entry of PLATFORM_REGISTRY) {
    console.log(`\n  ${entry.platform} — ${entry.agency}`);

    if (entry.platform === "IonWave") {
      try {
        const r = await collectIonWaveBoard(entry);
        ionwaveBoards++;
        totalSaved += r.saved;
        console.log(`  rows=${r.rows} roofing_saved=${r.saved} rejected=${r.rejected}`);
      } catch(e) {
        console.log(`  IonWave board failed: ${e.message}`);
      }
      continue;
    }

    if (entry.platform === "Bonfire") {
      try {
        const r = await collectBonfirePortal(entry);
        totalSaved += r.saved;
        console.log(`  projects=${r.projects} roofing_saved=${r.saved} rejected=${r.rejected}`);
      } catch(e) {
        console.log(`  Bonfire portal failed: ${e.message}`);
      }
      continue;
    }

    const p = await probePortal(entry);
    if (p.reachable && !p.looksBlocked) {
      console.log(`  Public portal reachable (HTTP ${p.status}); adapter needed.`);
    } else {
      console.log(`  Portal not directly machine-readable (HTTP ${p.status ?? "n/a"}).`);
      blocked.push(`${entry.platform}: ${entry.agency}`);
    }
  }

  console.log("\nPlatform connector summary:");
  console.log(`  IonWave boards processed: ${ionwaveBoards}`);
  console.log(`  Roofing opportunities saved/updated: ${totalSaved}`);
  if (blocked.length) {
    console.log("  Portals requiring a dedicated public-access adapter or vendor account:");
    for (const b of blocked) console.log(`    - ${b}`);
  }

  return totalSaved;
}


/* ---------------- Early Project Signals ---------------- */

const EARLY_SIGNAL_SOURCES = [
  {
    name: "Lewisville ISD Upcoming Bids",
    agency: "Lewisville Independent School District",
    city: "Lewisville",
    url: "https://www.lisd.net/our-district/all-departments/procurement/upcoming-bids-and-documents"
  }
];

function parseLewisvilleUpcoming(html, source) {
  const $ = cheerio.load(html);
  $("nav, footer, header, script, style, noscript").remove();
  const text = $("body").text().replace(/\r/g, "\n");

  const chunks = text
    .split(/\*{8,}/)
    .map(x => clean(x))
    .filter(Boolean);

  const results = [];

  for (const chunk of chunks) {
    const roofing = roofingScore(chunk);
    if (roofing < 80) continue;

    const idMatch = chunk.match(/\b(RFP|CSP|IFB|RFQ|RFB|CSB)\s*#?\s*([A-Z0-9.-]+)/i);
    const openMatch = chunk.match(/Opens?\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    const availableMatch = chunk.match(/available on\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);

    let title = chunk;
    if (openMatch) title = chunk.slice(0, openMatch.index).trim();
    title = clean(title).slice(0, 500);

    results.push({
      title,
      description: chunk.slice(0, 5000),
      agency: source.agency,
      city: source.city,
      state: "TX",
      project_type: "Roofing / Facilities",
      estimated_value: null,
      posted_date: availableMatch ? dateOnly(availableMatch[1]) : null,
      deadline: null,
      expected_bid_date: openMatch ? dateOnly(openMatch[1]) : null,
      solicitation_number: idMatch ? `${idMatch[1].toUpperCase()} ${idMatch[2]}` : null,
      source: source.name,
      source_url: source.url,
      roofing_relevance: roofing,
      status: "planned",
      stage: "Upcoming / Pre-Bid"
    });
  }

  return results;
}

async function collectEarlySignals() {
  console.log("\n[5/7] Early Project Signals");
  let saved = 0;

  for (const source of EARLY_SIGNAL_SOURCES) {
    console.log(`\n  ${source.name}`);
    try {
      const html = await fetchText(source.url, {
        retries: 2,
        cacheTtlMs: 30 * 60 * 1000,
        minimumDelayMs: 800
      });

      const signals = parseLewisvilleUpcoming(html, source);
      console.log(`  Roofing early signals found: ${signals.length}`);

      for (const signal of signals) {
        try {
          const result = await ingestOpportunity(signal);
          if (result.saved) {
            saved++;
            console.log(`  ✓ Upcoming: ${signal.title}`);
          }
        } catch (e) {
          console.log(`  ✗ Early signal failed: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`  Source failed: ${e.message}`);
    }
  }

  console.log(`Early signals saved/updated: ${saved}`);
  return saved;
}


/* ---------------- Existing Project Reconciliation ---------------- */

async function moveProjectChildren(fromProjectId, toProjectId) {
  const tables = [
    ["project_sources", "project_id"],
    ["solicitations", "project_id"],
    ["documents", "project_id"],
    ["project_events", "project_id"],
    ["project_participants", "project_id"],
    ["raw_ingest", "linked_project_id"]
  ];

  for (const [table, field] of tables) {
    try {
      await sbPatch(
        table,
        `${field}=eq.${escEq(fromProjectId)}`,
        { [field]: toProjectId },
        "return=minimal"
      );
    } catch (e) {
      // A uniqueness collision can happen when both projects already have the same source link.
      // In that case we leave the child row in place rather than risking data loss.
      console.log(`    Could not move all ${table} rows: ${e.message}`);
    }
  }
}

async function reconcileExistingProjectDuplicates() {
  console.log("\n[6/7] Project Deduplication / Lifecycle Reconciliation");

  const projects = await sbGet(
    "projects?select=*&order=first_discovered_at.asc&limit=1000"
  );

  const byOwner = new Map();
  for (const p of projects) {
    const key = p.owner_organization_id || `no-owner:${p.city || ""}:${p.state || ""}`;
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(p);
  }

  let merged = 0;

  for (const group of byOwner.values()) {
    for (let i = 0; i < group.length; i++) {
      const canonical = group[i];
      if (canonical.__merged) continue;

      for (let j = i + 1; j < group.length; j++) {
        const duplicate = group[j];
        if (duplicate.__merged) continue;

        const score = projectIdentitySimilarity(
          canonical.canonical_title,
          duplicate.canonical_title
        );

        const sameCity =
          !canonical.city ||
          !duplicate.city ||
          clean(canonical.city).toLowerCase() === clean(duplicate.city).toLowerCase();

        if (score < 0.78 || !sameCity) continue;

        // Keep the earliest-discovered project as canonical.
        const keep = new Date(canonical.first_discovered_at) <= new Date(duplicate.first_discovered_at)
          ? canonical
          : duplicate;
        const drop = keep.id === canonical.id ? duplicate : canonical;

        console.log(`  MERGE ${score.toFixed(2)}:`);
        console.log(`    KEEP: ${keep.canonical_title}`);
        console.log(`    LINK: ${drop.canonical_title}`);

        await moveProjectChildren(drop.id, keep.id);

        const stages = ["signal","planning","design","pre_bid","bidding","awarded","construction","completed","cancelled"];
        const keepRank = stages.indexOf(keep.lifecycle_stage);
        const dropRank = stages.indexOf(drop.lifecycle_stage);
        const bestStage = dropRank > keepRank ? drop.lifecycle_stage : keep.lifecycle_stage;

        await sbPatch(
          "projects",
          `id=eq.${escEq(keep.id)}`,
          {
            roofing_relevance: Math.max(Number(keep.roofing_relevance || 0), Number(drop.roofing_relevance || 0)),
            description:
              (drop.description || "").length > (keep.description || "").length
                ? drop.description
                : keep.description,
            lifecycle_stage: bestStage,
            status: ["active"].includes(keep.status) || ["active"].includes(drop.status) ? "active" : keep.status,
            expected_bid_date: keep.expected_bid_date || drop.expected_bid_date,
            estimated_value: keep.estimated_value || drop.estimated_value,
            last_updated_at: new Date().toISOString()
          },
          "return=minimal"
        );

        await sbPost("project_events", {
          project_id: keep.id,
          event_type: "duplicate_project_merged",
          event_date: new Date().toISOString(),
          title: "Duplicate project record reconciled",
          description: `Merged "${drop.canonical_title}" into "${keep.canonical_title}"`,
          old_value: { duplicate_project_id: drop.id },
          new_value: { canonical_project_id: keep.id, similarity: score }
        }, "return=minimal");

        // Keep an audit trail in the raw/source tables; remove only the duplicate project shell
        // after successfully moving its relations.
        try {
          await sbDelete("projects", `id=eq.${escEq(drop.id)}`);
          drop.__merged = true;
          merged++;
        } catch (e) {
          console.log(`    Duplicate shell retained: ${e.message}`);
        }
      }
    }
  }

  console.log(`Duplicate project records merged: ${merged}`);
  return merged;
}


async function auditDatabaseQuality() {
  console.log("\n[7/7] Database Quality Audit");

  const projects = await sbGet(
    "projects?select=id,canonical_title,lifecycle_stage,status,roofing_relevance,city,state,expected_bid_date,estimated_value,confidence&order=last_updated_at.desc&limit=1000"
  );

  const active = projects.filter(p => p.status === "active");
  const bidding = active.filter(p => p.lifecycle_stage === "bidding");
  const prebid = active.filter(p => p.lifecycle_stage === "pre_bid");
  const missingCity = active.filter(p => !p.city);
  const missingDate = active.filter(p => !p.expected_bid_date);
  const lowConfidence = active.filter(p => Number(p.confidence || 0) < 70);

  console.log(`  Total projects: ${projects.length}`);
  console.log(`  Active projects: ${active.length}`);
  console.log(`  Active bidding: ${bidding.length}`);
  console.log(`  Active pre-bid: ${prebid.length}`);
  console.log(`  Active missing city: ${missingCity.length}`);
  console.log(`  Active missing bid date: ${missingDate.length}`);
  console.log(`  Active confidence < 70: ${lowConfidence.length}`);

  if (active.length) {
    console.log("  Active project snapshot:");
    for (const p of active.slice(0, 10)) {
      console.log(
        `    - ${p.canonical_title} | ${p.lifecycle_stage} | ${p.city || "city?"}, ${p.state || "TX"} | ${p.expected_bid_date || "date?"} | rel ${p.roofing_relevance ?? "?"} | conf ${p.confidence ?? "?"}`
      );
    }
  }

  return {
    total: projects.length,
    active: active.length,
    bidding: bidding.length,
    prebid: prebid.length,
    missingCity: missingCity.length,
    missingDate: missingDate.length,
    lowConfidence: lowConfidence.length
  };
}

async function main() {
  console.log("\n====================================");
  console.log(" Roofing Signal Collector — Working V1");
  console.log("====================================");

  let txdot = 0;
  let samGov = 0;
  let esbd = 0;
  let schools = 0;
  let publicEntities = 0;
  let platforms = 0;
  let earlySignals = 0;
  let duplicatesMerged = 0;
  let qaResults = null;

  try {
    samGov = await collectSamGov();
  } catch (e) {
    console.log(`SAM.gov source failed: ${e.message}`);
  }

  try {
    txdot = await collectTxDot();
  } catch (e) {
    console.log(`TxDOT source failed: ${e.message}`);
  }

  try {
    esbd = await collectEsbd();
  } catch (e) {
    console.log(`ESBD source failed: ${e.message}`);
  }

  if (process.env.ENABLE_GENERIC_SCHOOLS === "1") {
    try {
      schools = await collectTexasSchools();
    } catch (e) {
      console.log(`Texas Schools source failed: ${e.message}`);
    }
  } else {
    console.log("\n[3/7] Generic school crawler skipped (V4 default).");
  }

  if (process.env.ENABLE_GENERIC_PUBLIC_ENTITIES === "1") {
    try {
      publicEntities = await collectTexasPublicEntities();
    } catch (e) {
      console.log(`Texas Public Entities source failed: ${e.message}`);
    }
  } else {
    console.log("\n[4/7] Generic public-entity crawler skipped (V4 default).");
  }

  try {
    platforms = await collectProcurementPlatforms();
  } catch (e) {
    console.log(`Procurement Platform source failed: ${e.message}`);
  }

  try {
    earlySignals = await collectEarlySignals();
  } catch (e) {
    console.log(`Early Signals source failed: ${e.message}`);
  }

  try {
    duplicatesMerged = await reconcileExistingProjectDuplicates();
  } catch (e) {
    console.log(`Project reconciliation failed: ${e.message}`);
  }

  try {
    qaResults = await auditDatabaseQuality();
  } catch (e) {
    console.log(`Database quality audit failed: ${e.message}`);
  }

  console.log("\n====================================");
  console.log(`SAM.gov saved/updated: ${samGov}`);
  console.log(`TxDOT saved/updated: ${txdot}`);
  console.log(`ESBD saved/updated:  ${esbd}`);
  console.log(`Texas Schools saved: ${schools}`);
  console.log(`Public entities:      ${publicEntities}`);
  console.log(`Platform connectors: ${platforms}`);
  console.log(`Early signals:       ${earlySignals}`);
  console.log(`Duplicates merged:   ${duplicatesMerged}`);
  console.log(`TOTAL INGEST EVENTS: ${samGov + txdot + esbd + schools + publicEntities + platforms + earlySignals}`);
  console.log("Collector finished.");
  console.log("====================================\n");
}

main().catch(err => {
  console.error("\nCollector failed:");
  console.error(err);
  process.exit(1);
});
