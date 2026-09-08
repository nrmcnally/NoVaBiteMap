# BiteMap public copy audit — 2026-09-08

## What felt artificial

The public interface mixed fishing language with internal model-development language. The problem was not the presence of caveats; it was that several caveats sounded like notes written for reviewers or developers instead of guidance written for anglers.

### 1. Abstract product slogans

- “Evidence-led,” “Today’s opportunity board,” and “fishing intelligence” sounded promotional without helping someone use the map.
- These were replaced with direct labels such as “Sources included,” “Fishing conditions,” and “spot details.”

### 2. Internal implementation details in normal workflows

- “Precomputed forecast scores,” “provider-backed score matrix,” “canonical science model,” “forecast anchor,” and “provider period” exposed engineering terminology.
- The interface now describes what the user receives: a forecast time, a score, the weather location used, and how multiple species are ranked.
- The detailed methodology still explains that timeline scores are calculated once, because that is useful transparency, but it does so in plain language.

### 3. Research-pipeline jargon

- “Evidence gate,” “evidence-qualified,” “presence support,” “evidenced waters,” “presence-only,” and “promoted into the species catalog” sounded like an AI evaluation report.
- These are now phrased as “reliable fish record,” “linked waters,” “fish record,” “records without forecasts,” and “checked against a separate source.”

### 4. Repetitive defensive language

- Phrases such as “BiteMap did not invent replacement weather” and “will not fill gaps with invented species claims” repeated a system-defense message where a simple unavailable state was enough.
- Errors now say that the forecast or data is unavailable and explain what remains usable. Important scientific and safety caveats remain in the relevant spot, advisory, and methodology sections.

### 5. Awkward system-state metaphors

- “Trip storage is warming up” and “Favorite storage is warming up” obscured a database problem.
- These now use direct unavailable-state messages.

### 6. Dense source and hydrology labels

- “Source trail,” “verified hydrology association,” “representative gage,” and “association confidence” were accurate but unnatural in the main interface.
- They are now “Sources,” “nearby stream gauge,” and straightforward explanations of how gauge relevance affects confidence.

## Language intentionally retained

- **Observed, forecast, estimated, historical, and unavailable** remain defined on the methodology page because these distinctions prevent estimates from being mistaken for measurements.
- **Confidence** remains separate from the fishing score.
- **Modeled** remains where the underlying value truly is modeled, including water temperature and historical weather.
- Agency names, advisory wording, source dates, species names, and research citations were not simplified in ways that would change their meaning.

## Areas revised

- Explore map, filters, results, map tooltips, timeline, and selected-spot dock
- Fish guide and fish detail pages
- Fishing-spot detail, forecast, source, and gauge sections
- Account, feedback, saved-spots, and trip-log states
- How It Works page and site metadata

