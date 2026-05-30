# Market-Specific Lead Packs

Use market presets when a paid pack should target a specific local real estate
area instead of broad national sources.

## North Mississippi First Market

Set these Render environment variables:

```txt
LEAD_ENGINE_MARKET=north-mississippi
LEAD_ENGINE_SOURCE_MODE=market
LEAD_ENGINE_MARKET_FILE=data/lead-engine-markets.json
LEAD_ENGINE_MAX_PAGES=20
LEAD_ENGINE_PACK_LIMIT=25
LEAD_ENGINE_MIN_CONFIDENCE=55
LEAD_ENGINE_MERGE_EXISTING=true
```

When `LEAD_ENGINE_SOURCE_MODE=market`, the worker ignores the old broad
`LEAD_ENGINE_SOURCE_URLS` value and uses the preset in:

```txt
data/lead-engine-markets.json
```

The current `north-mississippi` preset covers:

```txt
Tupelo
Oxford
Southaven
DeSoto County
Starkville
Columbus
Lee County
Lafayette County
Oktibbeha County
Lowndes County
```

## Adding Extra Sources

To add market preset sources and a few one-off URLs from Render, use:

```txt
LEAD_ENGINE_MARKET=north-mississippi
LEAD_ENGINE_SOURCE_MODE=append
LEAD_ENGINE_SOURCE_URLS=https://example-local-source.test/,https://another-source.test/
```

`append` combines the preset plus your manual URLs.

## Manual One-Off Market

To skip presets completely:

```txt
LEAD_ENGINE_MARKET=
LEAD_ENGINE_SOURCE_MODE=manual
LEAD_ENGINE_SOURCE_URLS=https://source-one.test/,https://source-two.test/
```

## Future Market: Houston

Add Houston / Harris County URLs under this preset:

```txt
houston-harris-county
```

Then set:

```txt
LEAD_ENGINE_MARKET=houston-harris-county
LEAD_ENGINE_SOURCE_MODE=market
```

## Safety Behavior

The worker still refuses to overwrite the active production pack when a crawl
returns zero qualified records.

Expected safe failure:

```txt
lead engine run failed: No qualified lead records were produced. Keep the existing production pack unchanged.
```

That protects paid inventory from becoming empty after a weak crawl.
