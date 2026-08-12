ROOFING SIGNAL COLLECTOR V4 — DATABASE QUALITY & COVERAGE

V4 changes:
- Generic school crawler skipped by default.
- Generic public-entity crawler skipped by default.
- Structured platform collectors remain active.
- Early signals remain active.
- Better city, ZIP, estimated value, and status extraction.
- Every raw_ingest record gets data_quality_score and data_quality_flags.
- Project confidence combines roofing relevance with data completeness.
- End-of-run Database Quality Audit.
- CREATE_WEBSITE_FEED_VIEW.sql included for the next app-integration round.

Optional generic crawlers:
ENABLE_GENERIC_SCHOOLS=1
ENABLE_GENERIC_PUBLIC_ENTITIES=1

Default is 0.
