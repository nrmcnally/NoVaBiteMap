# API design

FastAPI serves OpenAPI at `/docs` and `/openapi.json`. The edge site also
exposes `/api/conditions` for a selected NWS forecast and authenticated D1
favorite routes used by the deployed web surface.

Core FastAPI routes:

```text
GET    /health
GET    /api/species
GET    /api/species/search?q=smallmouth
GET    /api/species/{species_id}
GET    /api/locations
GET    /api/locations/search?q=burke
GET    /api/locations/nearby?latitude=...&longitude=...&radius_miles=...
GET    /api/locations/{location_id}
GET    /api/locations/{location_id}/species
GET    /api/locations/{location_id}/conditions
GET    /api/hydrology/{usgs_station_id}
GET    /api/opportunities/ranked?species_id=smallmouth-bass
POST   /api/opportunities/score
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/users/me
GET    /api/users/me/favorites
POST   /api/users/me/favorites
PATCH  /api/users/me/favorites/{favorite_id}
DELETE /api/users/me/favorites/{favorite_id}
GET    /api/data-sources/status
POST   /api/admin/ingestion/dwr-access
```

Ranking filters include species, drive minutes, access method, and a confidence
threshold. Nearby search uses geographic radius. Alias search is exact/prefix
first and uses a conservative similarity gate for fuzzy matches.

Authenticated FastAPI routes accept `Authorization: Bearer <token>`. Passwords
use salted PBKDF2-HMAC-SHA256 with 600,000 iterations. Random session tokens are
stored only as SHA-256 hashes and expire.

