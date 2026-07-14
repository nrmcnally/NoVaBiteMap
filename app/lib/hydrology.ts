export type HydrologyAssociation = {
  stationId: string;
  stationName: string;
  monitorUrl: string;
  associationFactor: number;
  associationType: "same-waterbody" | "connected-reach";
  basis: string;
  limitation: string;
};

type Station = Omit<HydrologyAssociation, "associationFactor" | "associationType" | "basis" | "limitation">;

const stations: Record<string, Station> = {
  "01629500": {
    stationId: "01629500",
    stationName: "South Fork Shenandoah River near Luray, VA",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01629500/",
  },
  "01631000": {
    stationId: "01631000",
    stationName: "South Fork Shenandoah River at Front Royal, VA",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01631000/",
  },
  "01634000": {
    stationId: "01634000",
    stationName: "North Fork Shenandoah River near Strasburg, VA",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01634000/",
  },
  "01636500": {
    stationId: "01636500",
    stationName: "Shenandoah River at Millville, WV",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01636500/",
  },
  "01638500": {
    stationId: "01638500",
    stationName: "Potomac River at Point of Rocks, MD",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01638500/",
  },
  "01646500": {
    stationId: "01646500",
    stationName: "Potomac River near Washington, DC",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01646500/",
  },
  "01656703": {
    stationId: "01656703",
    stationName: "Occoquan Reservoir above Bull Run near Clifton, VA",
    monitorUrl: "https://waterdata.usgs.gov/monitoring-location/USGS-01656703/",
  },
};

const exact = (stationId: string, basis: string, limitation: string): HydrologyAssociation => ({
  ...stations[stationId],
  associationFactor: 1,
  associationType: "same-waterbody",
  basis,
  limitation,
});

const connected = (stationId: string, basis: string, limitation: string): HydrologyAssociation => ({
  ...stations[stationId],
  associationFactor: 0.85,
  associationType: "connected-reach",
  basis,
  limitation,
});

export const hydrologyAssociations: Record<string, HydrologyAssociation> = {
  "front-royal": exact(
    "01631000",
    "The USGS gage is on the South Fork at Front Royal, immediately upstream of the North Fork confluence.",
    "Conditions can still differ around dams, tributary mouths, and individual access points.",
  ),
  karo: connected("01631000", "Verified South Fork gage downstream on the same connected reach.", "Local depth and velocity may differ from the gage reach."),
  simpsons: connected("01631000", "Verified South Fork gage downstream on the same connected reach.", "Local depth and velocity may differ from the gage reach."),
  bentonville: connected("01629500", "Verified South Fork gage upstream near Luray on the same connected river.", "Tributary inflow between the gage and access can change conditions."),
  "catletts-ford": connected("01634000", "Verified North Fork gage near Strasburg on the same connected river.", "This is a reach-level association, not an access-point measurement."),
  riverton: connected("01634000", "Verified North Fork gage upstream of the South Fork confluence.", "Confluence conditions may differ from the upstream gage."),
  "morgans-ford": connected("01636500", "Verified main-stem Shenandoah gage downstream at Millville.", "Multiple tributaries enter between this access and the gage."),
  berrys: connected("01636500", "Verified main-stem Shenandoah gage downstream at Millville.", "Multiple tributaries enter between this access and the gage."),
  "castlemans-ferry": connected("01636500", "Verified main-stem Shenandoah gage downstream at Millville.", "Multiple tributaries enter between this access and the gage."),
  lockes: connected("01636500", "Verified main-stem Shenandoah gage downstream at Millville.", "Multiple tributaries enter between this access and the gage."),
  "point-of-rocks": exact("01638500", "USGS operates the Potomac gage at Point of Rocks beside this access area.", "A gage reading does not establish launch or wading safety."),
  "piscataway-crossing": connected("01638500", "Verified Potomac gage upstream at Point of Rocks.", "Tributaries and local channel geometry can change conditions downstream."),
  "great-falls": connected("01646500", "Verified Potomac gage downstream near Little Falls.", "Great Falls has extreme site-specific hazards; never infer safety from discharge alone."),
  "riverbend-park": connected("01646500", "Verified Potomac gage downstream near Little Falls.", "Great Falls lies between the access and gage; use the reading only as broad river context."),
  "seneca-regional": connected("01646500", "Verified Potomac gage downstream near Little Falls.", "The distance and intervening tributaries reduce local representativeness."),
  algonkian: connected("01646500", "Verified Potomac gage downstream near Little Falls.", "The distance and intervening tributaries reduce local representativeness."),
  fountainhead: connected("01656703", "Verified USGS station on the Occoquan Reservoir above Bull Run.", "Reservoir conditions vary by arm, depth, and dam operations."),
  "bull-run-marina": connected("01656703", "Verified USGS station on the Occoquan Reservoir above Bull Run.", "Reservoir conditions vary by arm, depth, and dam operations."),
  "lake-ridge-marina": connected("01656703", "Verified USGS station on the Occoquan Reservoir above Bull Run.", "Reservoir conditions vary by arm, depth, and dam operations."),
};

export const hydrologyForLocation = (locationId: string) => hydrologyAssociations[locationId];
