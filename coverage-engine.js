require("dotenv").config();
const fs = require("fs");
const path = require("path");

const registry = JSON.parse(fs.readFileSync(path.join(__dirname, "san_antonio_sources.json"), "utf8"));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const dryRun = process.argv.includes("--dry-run");
const probeOnly = process.argv.includes("--probe");
const publicCheck = process.argv.includes("--check-public");

async function request(route, options = {}) {
  const response = await fetch(`${url}/rest/v1/${route}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function eq(value) {
  return encodeURIComponent(String(value));
}

async function registerSource(item, territoryId) {
  const existing = await request(`sources?select=id&name=eq.${eq(item.name)}&limit=1`);
  const body = {
    name: item.name,
    source_type: "coverage_source",
    base_url: item.url,
    platform: item.platform,
    jurisdiction: "San Antonio + 75 miles",
    is_active: true,
    collection_method: "coverage_engine",
    territory_id: territoryId,
    organization_name: item.organization,
    source_category: item.category,
    priority: item.priority,
    expected_check_interval_hours: item.intervalHours,
    updated_at: new Date().toISOString()
  };

  if (existing.length) {
    await request(`sources?id=eq.${eq(existing[0].id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { Prefer: "return=representation" }
    });
    return existing[0].id;
  }

  const created = await request("sources", { method: "POST", body: JSON.stringify(body) });
  return created[0].id;
}

async function probeSource(item, sourceId) {
  const startedAt = new Date().toISOString();
  let status = "success";
  let httpStatus = null;
  let errorMessage = null;
  let responseUrl = item.url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(item.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "RoofingSignalCoverageMonitor/1.0" }
    });
    clearTimeout(timeout);
    httpStatus = response.status;
    responseUrl = response.url;
    await response.body?.cancel();
    if (!response.ok) {
      status = response.status === 401 || response.status === 403 || response.status === 429 ? "partial" : "failed";
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (error) {
    status = "failed";
    errorMessage = error.name === "AbortError" ? "Timed out after 20 seconds" : error.message;
  }

  const finishedAt = new Date().toISOString();
  await request("source_runs", {
    method: "POST",
    body: JSON.stringify({
      source_id: sourceId,
      started_at: startedAt,
      finished_at: finishedAt,
      status,
      http_status: httpStatus,
      error_message: errorMessage,
      metadata: { requested_url: item.url, response_url: responseUrl, check_type: "availability" }
    })
  });

  const sourceUpdate = {
    last_checked_at: finishedAt,
    last_collection_status: status,
    last_error: errorMessage,
    updated_at: finishedAt
  };
  if (status === "success") {
    sourceUpdate.consecutive_failures = 0;
    sourceUpdate.last_successful_collection_at = finishedAt;
  } else {
    const rows = await request(`sources?select=consecutive_failures&id=eq.${eq(sourceId)}&limit=1`);
    sourceUpdate.consecutive_failures = Number(rows[0]?.consecutive_failures || 0) + 1;
    sourceUpdate.last_failure_at = finishedAt;
  }
  await request(`sources?id=eq.${eq(sourceId)}`, {
    method: "PATCH",
    body: JSON.stringify(sourceUpdate),
    headers: { Prefer: "return=minimal" }
  });

  return { status, httpStatus, errorMessage };
}

async function main() {
  console.log(`Coverage Engine V1 — San Antonio + 75 miles`);
  console.log(`Registry sources: ${registry.length}`);
  if (dryRun) {
    for (const item of registry) console.log(`[P${item.priority}] ${item.category.padEnd(20)} ${item.organization}`);
    return;
  }
  if (publicCheck) {
    const summary = { success: 0, partial: 0, failed: 0 };
    for (const item of registry) {
      let status = "success";
      let code = null;
      let message = "";
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(item.url, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": "RoofingSignalCoverageMonitor/1.0" } });
        clearTimeout(timeout);
        code = response.status;
        await response.body?.cancel();
        if (!response.ok) status = [401, 403, 429].includes(code) ? "partial" : "failed";
      } catch (error) {
        status = "failed";
        message = error.name === "AbortError" ? "timed out" : error.message;
      }
      summary[status] += 1;
      console.log(`[${status.toUpperCase()}${code ? ` ${code}` : ""}] ${item.organization}${message ? ` — ${message}` : ""}`);
    }
    console.log(`Public check: ${summary.success} healthy, ${summary.partial} restricted, ${summary.failed} failed.`);
    return;
  }
  if (!url || !key) throw new Error("Copy the existing collector .env into this Collector folder first.");
  const territories = await request("coverage_territories?select=id&name=eq.San%20Antonio%20%2B%2075%20miles&limit=1");
  if (!territories.length) throw new Error("Run Database/03_COVERAGE_ENGINE_V1.sql in Supabase first.");
  const summary = { success: 0, partial: 0, failed: 0 };
  for (const item of registry) {
    const sourceId = await registerSource(item, territories[0].id);
    if (!probeOnly) console.log(`Registered: ${item.organization}`);
    const result = await probeSource(item, sourceId);
    summary[result.status] += 1;
    console.log(`[${result.status.toUpperCase()}${result.httpStatus ? ` ${result.httpStatus}` : ""}] ${item.organization}${result.errorMessage ? ` — ${result.errorMessage}` : ""}`);
  }
  console.log(`Coverage check complete: ${summary.success} healthy, ${summary.partial} restricted, ${summary.failed} failed.`);
}

main().catch(error => { console.error(error.message); process.exit(1); });
