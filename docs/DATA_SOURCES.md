# Data sources and provenance

Every imported record keeps provider, source URL, source record id, retrieval
time, dataset version, sampling method, and use notes. These sources are the
Phase 1 provider contract:

| Source | Phase 1 use | Official endpoint |
|---|---|---|
| Virginia DWR Boating Access | Verified public access coordinates | `services.dwr.virginia.gov/.../Public/BoatingAccessSites/FeatureServer/0` |
| Virginia DWR stocked trout | Designated water geometry and dated categories | `services.dwr.virginia.gov/.../StockedTroutWaters` and current stocking plan |
| Virginia DWR fisheries reports | Species and long-term quality evidence | Dated DWR pages and PDFs retained per curated record |
| National Weather Service API | Hourly forecast and alerts | `api.weather.gov` |
| USGS Water Services | Discharge, stage, water temperature, turbidity, DO | `waterservices.usgs.gov/nwis/iv/` |
| USGS Aquatic GAP v2.0 | Landscape-scale modeled distribution evidence | USGS data release DOI `10.5066/P94XM9XV` |
| EPA Water Quality Portal | Method-preserved water quality observations | `waterqualitydata.us` |
| EPA StreamCat/LakeCat | Static watershed and habitat features | EPA release downloads |
| NHDPlus | Reach identity, catchments, flow connectivity | Version-pinned EPA/USGS distribution |

The DWR access seed was queried and reviewed on 2026-07-13. A geographically
nearest USGS station is never assumed representative. Station associations need
same-waterbody/watershed evidence and manual verification before influencing a
public score.

