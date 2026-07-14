/**
 * Registry of verified, freely-usable fish photos.
 *
 * Only public-domain (e.g. U.S. Fish & Wildlife Service / USGS federal works) or
 * explicitly PD/CC0 assets belong here. Each entry stores full attribution so the
 * UI can display a visible credit. Files live in /public/fish/<id>.jpg.
 *
 * Sourced 2026-07-14 and individually license-verified. Most are Duane Raver
 * USFWS-commissioned illustrations or USFWS/USGS photographs (public domain).
 */
export type FishImage = {
  src: string;
  credit: string;
  license: string;
  sourceUrl: string;
};

export const fishImages: Record<string, FishImage> = {
  "smallmouth-bass": { src: "/fish/smallmouth-bass.jpg", credit: "Duane Raver / U.S. Fish & Wildlife Service", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Smallmouth_bass.jpg" },
  "largemouth-bass": { src: "/fish/largemouth-bass.jpg", credit: "Duane Raver / U.S. Fish & Wildlife Service", license: "Public domain (released into public domain; USFWS work)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Largemouth_bass_fish_art_work_micropterus_salmoides.jpg" },
  "spotted-bass": { src: "/fish/spotted-bass.jpg", credit: "Noel Burkhead / Howard Jelks, U.S. Geological Survey (USGS)", license: "Public domain (U.S. Government work — USGS)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Micropterus_punctulatus.jpg" },
  "striped-bass": { src: "/fish/striped-bass.jpg", credit: "Duane Raver / U.S. Fish & Wildlife Service", license: "Public domain (released into public domain; USFWS work)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Striped_bass_morone_saxatilis_fish_(white_background).jpg" },
  "walleye": { src: "/fish/walleye.jpg", credit: "Sam Stukel / U.S. Fish & Wildlife Service", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Walleye_(Sander_vitreus)_(1).jpg" },
  "bluegill": { src: "/fish/bluegill.jpg", credit: "Ryan Hagerty/USFWS", license: "Public domain (U.S. Fish & Wildlife Service work)", sourceUrl: "https://www.fws.gov/media/bluegill" },
  "redbreast-sunfish": { src: "/fish/redbreast-sunfish.jpg", credit: "USFWS", license: "Public domain (U.S. Fish & Wildlife Service work)", sourceUrl: "https://www.fws.gov/media/redbreast-sunfishjpg" },
  "black-crappie": { src: "/fish/black-crappie.jpg", credit: "Duane Raver / USFWS", license: "Public domain (artwork commissioned by U.S. Fish & Wildlife Service)", sourceUrl: "https://www.fws.gov/media/black-crappie-1" },
  "white-crappie": { src: "/fish/white-crappie.jpg", credit: "Duane Raver / U.S. Fish and Wildlife Service", license: "Public domain (USFWS work; Commons file page tagged public domain)", sourceUrl: "https://commons.wikimedia.org/wiki/File:White_crappie_pomoxis_annularis.jpg" },
  "yellow-perch": { src: "/fish/yellow-perch.jpg", credit: "Robert Colletta / USDA Agricultural Research Service", license: "Public domain (work of a U.S. federal government employee)", sourceUrl: "https://commons.wikimedia.org/wiki/File:D3149-1._yellow_perch_(Perca_flavescens).jpg" },
  "white-perch": { src: "/fish/white-perch.jpg", credit: "Matthew Patterson/USFWS", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://www.fws.gov/media/morone-americana" },
  "channel-catfish": { src: "/fish/channel-catfish.jpg", credit: "Sam Stukel/USFWS", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://www.fws.gov/media/channel-catfish" },
  "blue-catfish": { src: "/fish/blue-catfish.jpg", credit: "Brett Billings/USFWS", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://www.fws.gov/media/blue-catfish-0" },
  "flathead-catfish": { src: "/fish/flathead-catfish.jpg", credit: "Duane Raver/USFWS", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://www.fws.gov/media/flathead-catfish" },
  "common-carp": { src: "/fish/common-carp.jpg", credit: "Sam Stukel/USFWS", license: "Public domain (U.S. Government work — USFWS)", sourceUrl: "https://www.fws.gov/media/common-carp-10" },
  "rainbow-trout": { src: "/fish/rainbow-trout.jpg", credit: "Sam Stukel/USFWS", license: "Public domain (U.S. Fish & Wildlife Service work)", sourceUrl: "https://www.fws.gov/media/rainbow-trout-oncorhynchus-mykiss" },
  "brown-trout": { src: "/fish/brown-trout.jpg", credit: "Timothy Knepp, U.S. Fish and Wildlife Service", license: "Public domain (released into PD by author; USFWS work)", sourceUrl: "https://commons.wikimedia.org/wiki/File:Brown_trout_Salmo_trutta.jpg" },
  "brook-trout": { src: "/fish/brook-trout.jpg", credit: "Ryan Hagerty/USFWS", license: "Public domain (U.S. Fish & Wildlife Service work)", sourceUrl: "https://www.fws.gov/media/brook-trout-25" },
  "northern-snakehead": { src: "/fish/northern-snakehead.jpg", credit: "USFWS", license: "Public domain (U.S. Fish & Wildlife Service work)", sourceUrl: "https://www.fws.gov/media/northern-snakehead" },
  "muskellunge": { src: "/fish/muskellunge.jpg", credit: "Sam Stukel/USFWS", license: "Public domain (U.S. Fish & Wildlife Service work)", sourceUrl: "https://www.fws.gov/media/muskellunge-1" },
};

export function fishImageFor(speciesId: string): FishImage | undefined {
  return fishImages[speciesId];
}
