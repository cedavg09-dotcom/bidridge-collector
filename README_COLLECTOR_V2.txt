ROOFING SIGNAL COLLECTOR V2

This is the next collection layer for Roofing Signal Database V1.

WHAT V2 ADDS
- 429 rate-limit retry/backoff.
- Local source caching so the same procurement board is not repeatedly hammered.
- Stale-cache fallback if a public source temporarily fails.
- More reusable IonWave boards, including City of Irving, City of Arlington,
  and Lewisville ISD.
- Early-project signal ingestion.
- Lewisville ISD upcoming-bid parsing is the first early-signal adapter.
- Planned projects are stored as lifecycle_stage=pre_bid rather than pretending
  they are already open solicitations.
- All qualifying records still use Database V1:
  raw_ingest -> projects -> project_sources -> solicitations -> project_events.

WHY EARLY SIGNALS MATTER
An upcoming roofing procurement can now enter Roofing Signal before the formal
bid is open. The same project can later be updated when bidding opens.

CACHE
The collector creates .collector_cache.json locally.
Do not publish it as source code. It may be deleted safely; the collector will
rebuild it.

FIRST RUN
1. Copy your working .env into this folder.
2. Run CHECK_DATABASE_MAC.command if you want to verify Database V1.
3. Run START_COLLECTOR_MAC.command.
4. Check Supabase projects and solicitations.

KNOWN LIMITS
- OpenGov may block automated public access.
- Some procurement portals may still require vendor login.
- Public-source coverage is not yet complete.
