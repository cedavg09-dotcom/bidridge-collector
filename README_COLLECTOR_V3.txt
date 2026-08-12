ROOFING SIGNAL COLLECTOR V3 — PROJECT INTELLIGENCE V1

V3 builds on Collector V2 and Database V1.

MAIN CHANGE: ONE REAL PROJECT, MANY SIGNALS
An early planning/pre-bid signal and a later formal solicitation should become
one canonical project, not two unrelated rows.

V3 ADDS
- Exact solicitation-number project linking.
- Conservative same-owner title similarity matching.
- Procurement-number/title normalization.
- Source-to-existing-project linking.
- Lifecycle events when a project moves from pre_bid to bidding.
- Deduplication events for auditability.
- Reconciliation of likely duplicate project shells already created by V2.
- Preservation of multiple project_sources and solicitations on the canonical project.

MATCHING SAFETY
V3 uses high similarity thresholds and same-owner/location checks.
It is designed to prefer missed merges over dangerous false merges.

EXPECTED LEWISVILLE TEST
The early Lewisville roofing RFP and the formal IonWave solicitation should
resolve to one canonical Lewisville roofing project, while preserving both
source records/evidence.

WHAT TO CHECK AFTER RUNNING
Supabase > projects:
- ideally one Lewisville roofing project, not two.

Supabase > project_sources:
- the Lewisville project should have multiple source/evidence links.

Supabase > solicitations:
- formal solicitation details should be attached to the same project.

Supabase > project_events:
- look for source_linked_by_deduplication, lifecycle_stage_changed,
  or duplicate_project_merged events.
