# Data sources and provenance

Every imported record keeps provider, source URL, source record id, retrieval
time, dataset version, sampling method, and use notes. These sources are the
Phase 1 provider contract:

| Source | Phase 1 use | Official endpoint |
|---|---|---|
| Virginia DWR Boating Access | Verified public access coordinates | `services.dwr.virginia.gov/.../Public/BoatingAccessSites/FeatureServer/0` |
| Virginia DWR stocked trout | 13 designated NOVA/nearby reach geometries, schedule categories, and named stocked species | `services.dwr.virginia.gov/.../VAFWIS/Stocked_Trout_Waters/FeatureServer/0` and the 2026 stocking plan |
| Virginia DWR fisheries reports | Species and long-term quality evidence | Dated DWR pages and PDFs retained per curated record |
| National Weather Service API | Hourly forecast and alerts | `api.weather.gov` |
| USGS Water Services | On-demand discharge, stage, water temperature, turbidity, conductance, and DO for 19 manually reviewed location associations | `waterservices.usgs.gov/nwis/iv/` |
| USGS Aquatic GAP presence/absence v2.0 | 94 method/source/date-preserved samples in five regional HUC8s; nearby presence is capped and labeled historical | USGS data release DOI `10.5066/P9FZ6J6R` |
| USGS Aquatic GAP modeled distributions v2.0 | Future landscape-scale modeled distribution evidence; not yet mixed into the public score | USGS data release DOI `10.5066/P94XM9XV` |
| EPA Water Quality Portal | Method-preserved water quality observations | `waterqualitydata.us` |
| EPA StreamCat/LakeCat | Static watershed and habitat features | EPA release downloads |
| NHDPlus | Reach identity, catchments, flow connectivity | Version-pinned EPA/USGS distribution |

The DWR access seed was queried and reviewed on 2026-07-13; the stocked-water
layer and USGS release were reviewed on 2026-07-14. The importer verifies the
published MD5 checksums before normalizing Aquatic GAP. A geographically nearest
USGS station is never assumed representative. Public station associations are
an explicit same-waterbody or connected-reach mapping with a visible limitation
and association confidence factor.

## Repeatable Phase 1 refresh

From PowerShell at the project root:

```powershell
.\scripts\refresh-public-data.ps1
```

The script downloads the pinned ScienceBase v2.0 presence/absence CSV and
species table plus the current DWR stocked-water GeoJSON. The Python importer
verifies both published USGS MD5 checksums before writing identical normalized
web and FastAPI snapshots. It filters to five regional HUC8s, preserves sample
source/date/COMID and valid absence, and retains only the configured BiteMap
species. No raw national dataset is committed.
