# Environmental snapshot and forecast capability contracts

Last updated: 2026-07-16

## Purpose

The interactive prediction timeline must stop where provider support stops.
BiteMap now exposes a species-agnostic capability response and a timestamp-
specific environmental snapshot before adding timeline controls or connecting
these inputs to additional species rules.

## Forecast capabilities

Contract version: `forecast-capabilities-v0.1.0`

Canonical endpoint:

```text
GET /api/locations/{location_id}/forecast-capabilities
```

Web-app proxy:

```text
GET /api/forecast-capabilities?locationId={location_id}
```

The response declares:

- the first and final NWS hourly timestamps actually returned;
- the supported daily-outlook dates derived from those hourly periods;
- provider generation, update, and retrieval times;
- available, modeled, and unavailable inputs;
- current USGS association status without projecting gage readings into the
  future;
- water-temperature provenance and its final modeled date;
- an explicit policy requiring unsupported future selections to be disabled.

The daily range is a labeled **Daily outlook**. It summarizes supported hourly
periods and is not presented as an exact-hour prediction.

## Environmental snapshot

Contract version: `environmental-snapshot-v0.1.0`

Canonical endpoint:

```text
GET /api/locations/{location_id}/environmental-snapshot?at={ISO-8601 timestamp}
```

Web-app proxy:

```text
GET /api/environmental-snapshot?locationId={location_id}&at={ISO-8601 timestamp}
```

The selected timestamp must include a time-zone offset and fall inside the
current hourly forecast window. Unsupported times return the capability
response with the rejection so the UI can reset or disable its controls.

Each snapshot contains:

- forecast air temperature, precipitation probability, wind, and weather
  summary with valid and retrieval times;
- observed or modeled water temperature only when the selected date is covered;
- deterministic solar elevation and phase at the selected timestamp;
- current provisional USGS hydrology as **observed current context**, never as
  a future gage forecast;
- explicit missing and modeled input lists;
- active NWS alerts;
- a hard declaration that the snapshot is species-agnostic and contains no
  opportunity score.

## Provenance states

- `observed`
- `observed-current-context`
- `forecast`
- `modeled-from-forecast`
- `deterministic`
- `unavailable`

Air temperature is not relabeled as water temperature. A current gage reading
is not projected through the forecast window. Missing inputs remain missing.

## Current implementation boundary

The contracts and API proxies are implemented and tested. They are not yet
wired to an Explore timeline or the map-wide scoring request. The next slice is
to add selected-time URL state and accessible hourly/daily controls, then make
the canonical scorer and all map/list consumers use the same explicit snapshot.
