ROOFING SIGNAL MASTER COLLECTOR v11

SOURCES
1. TxDOT Project Information
2. Texas Electronic State Business Daily (ESBD)

FIRST TIME
1. Double-click START_COLLECTOR_MAC.command.
2. It creates .env and opens it.
3. Paste your NEW Supabase Secret API key into .env.
4. Save.
5. Run START_COLLECTOR_MAC.command again.

IF YOU ALREADY HAVE A WORKING .env
Copy it from your older collector folder into this v4 folder before launching.

WHAT V4 DOES
- Keeps the strict TxDOT roofing filter.
- Scans the latest ESBD solicitation pages.
- Detects explicit roofing terms.
- Fetches matching ESBD detail pages when possible.
- Saves/updates matching opportunities in the same Supabase opportunities table.
- Uses source + solicitation_number for deduplication.

ESBD_PAGES
The .env file includes ESBD_PAGES=100.
At roughly 20 solicitations per page, this scans about 2,000 recent ESBD listings.
You can raise or lower this later.

SECURITY
Never share .env or your Supabase Secret API key.


V5.1
- Keeps strict final roofing filtering.
- Adds broader building/facility/school/campus renovation candidates.
- Opens those candidate detail pages to look for explicit roofing scope before saving.


V7 — TEXAS SCHOOLS AGGREGATOR
One reusable crawler now covers these major districts:
- Houston ISD
- Dallas ISD
- Plano ISD
- Austin ISD
- Northside ISD
- Katy ISD
- Frisco ISD
- Conroe ISD
- Cypress-Fairbanks ISD
- Fort Worth ISD

Instead of writing one scraper per district, V7:
- starts from each district's official procurement page,
- follows a limited set of procurement/opportunity links,
- inspects explicit roofing and broader building/facilities candidates,
- saves only opportunities with explicit roofing scope after detail review.

Future districts can be added to the TEXAS_SCHOOL_DISTRICTS registry without creating a new collector architecture.


V8 — TEXAS MASTER COLLECTOR
Source families in one package:
1. TxDOT official project feed
2. Texas ESBD statewide solicitations
3. Texas Schools Aggregator (10 major districts)
4. Texas Master Public-Entity Aggregator

The master public-entity registry starts with:
- 10 major cities
- 8 major counties
- 8 university/system procurement offices
- 7 additional public owners / authorities

Portal-aware discovery recognizes common public procurement platforms such as:
IonWave, Bonfire, OpenGov, BidNet, PlanetBids, PublicPurchase, DemandStar and BidSync.

IMPORTANT
V8 only reads publicly accessible pages. It does not bypass logins, CAPTCHAs,
anti-bot controls, or restricted/licensed procurement systems. Portal discoveries
are reported so platform-specific adapters can be added where public access allows.

EXPANSION MODEL
Going forward, add organizations to registries or add one reusable platform adapter.
Do not build one-off collectors unless absolutely necessary.


V8.1 QUALITY FIX
- Removes navigation/header/footer text before candidate extraction.
- Rejects elections, tutorials, insurance requirements, registration pages, policies, FAQs, and similar non-opportunities.
- Requires a solicitation signal (RFP/RFQ/IFB/CSP/bid number/due date/etc.) in the local opportunity block.
- Requires roofing terms in the actual title or solicitation detail context.
- Applies the same strict final gate to school and public-entity aggregators.


V9 — PROCUREMENT PLATFORM CONNECTORS
Adds a true reusable IonWave adapter and platform registry.

Seeded platform examples:
- Houston ISD IonWave
- Plano ISD IonWave
- Austin ISD Bonfire
- Katy ISD OpenGov

IONWAVE
Public IonWave Current Bid Opportunities pages are parsed directly.
The adapter extracts bid number, title, type, issue date and close date,
then applies the strict roofing filter and saves matching opportunities.

BONFIRE / OPENGOV
V9 probes the public portal URLs and reports whether they are directly
machine-readable. It does not bypass logins, 403 blocks, CAPTCHAs or
vendor-access controls. Those platforms need dedicated adapters only where
their public-access pages permit automated reading.

EXPANSION
The next high-leverage step is adding more public IonWave board URLs to the
PLATFORM_REGISTRY. One adapter can then cover many organizations.


V9.1 — IONWAVE PARSER FIX
- Fixes public IonWave board parsing.
- Handles both normal table cells and flattened HTML cell boundaries.
- Prints how many live bid rows were parsed before roofing filtering.
- Keeps the strict roofing-only save filter.


V10 — BONFIRE ADAPTER
- Keeps the working IonWave public-board adapter.
- Adds Bonfire parsing for visible opportunity cards/rows.
- Inspects embedded page data for project title/reference/deadline metadata.
- Follows only publicly accessible project detail pages.
- Does not bypass vendor logins, CAPTCHAs, or restricted data.
- Applies the same strict roofing + solicitation validation before saving.


V11 — PLATFORM BREADTH TEST
Expanded public procurement-platform registry:

IonWave:
- Houston ISD
- Plano ISD
- Coppell ISD
- Little Elm ISD
- City of Carrollton
- City of Denton
- Region 18 Education Service Center

Bonfire:
- Austin ISD
- Region 1 Education Service Center
- Region 5 Education Service Center

OpenGov:
- Katy ISD (probe/report only where access is restricted)

GOAL
V11 is designed to test breadth rather than invent another parser.
If the same working platform adapters across many agencies still produce very
few roofing opportunities, that is evidence the public-only data strategy may
not provide enough volume by itself.
