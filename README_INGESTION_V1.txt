ROOFING SIGNAL COLLECTOR v12 — INGESTION PIPELINE V1

IMPORTANT
Run Roofing Signal Database V1 SQL in Supabase BEFORE using this collector.

WHAT CHANGED
Older collectors wrote directly to public.opportunities.
V12 routes every saved roofing record through the new project-intelligence schema.

FLOW
source record
  -> raw_ingest
  -> source
  -> organization
  -> project detection / dedupe
  -> projects
  -> project_sources
  -> solicitations
  -> project_events

THE OLD opportunities TABLE
V12 does not rely on it for new ingestion.
Do not delete it yet; keep it until the new website is reading the new schema.

FIRST TIME
1. Copy your working .env file into this folder.
2. Double-click CHECK_DATABASE_MAC.command.
3. Confirm every Database V1 table shows a check mark.
4. Double-click START_COLLECTOR_MAC.command.

WHAT TO LOOK FOR IN SUPABASE
After a successful run:
- raw_ingest should contain source records
- sources should contain source definitions
- organizations should contain issuing agencies
- projects should contain canonical roofing projects
- solicitations should contain open/closed bid records
- project_sources should connect projects to evidence
- project_events should show discovery events

DEDUPLICATION V1
Projects are currently matched primarily by exact canonical title + city,
then by exact canonical title + owner.
This is intentionally conservative. Smarter fuzzy/entity dedupe comes next.

SECURITY
Keep the Supabase Secret API key only in .env.
Never put it in the Roofing Signal website/frontend.
