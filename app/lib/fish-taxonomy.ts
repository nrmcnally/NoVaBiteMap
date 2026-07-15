const FAMILY_LABELS: Record<string, string> = {
  Anguillidae: "Freshwater eels (Anguillidae)",
  Catostomidae: "Suckers (Catostomidae)",
  Centrarchidae: "Sunfishes & black bass (Centrarchidae)",
  Channidae: "Snakeheads (Channidae)",
  Cottidae: "Sculpins (Cottidae)",
  Cyprinidae: "Carps (Cyprinidae)",
  Dorosomatidae: "Thread herrings (Dorosomatidae)",
  Esocidae: "Pikes & muskellunge (Esocidae)",
  Ictaluridae: "North American catfishes (Ictaluridae)",
  Leuciscidae: "Minnows (Leuciscidae)",
  Moronidae: "Temperate basses (Moronidae)",
  Percidae: "Perches & darters (Percidae)",
  Salmonidae: "Trout & salmon (Salmonidae)",
};

export function scientificFamily(family?: string): string | undefined {
  return family?.match(/\(([A-Z][a-z]+idae)\)/)?.[1];
}

/** Group on scientific taxonomy instead of free-form common family wording. */
export function familyGroup(family?: string): string {
  if (!family) return "Other";
  const taxon = scientificFamily(family);
  return taxon ? (FAMILY_LABELS[taxon] ?? taxon) : family;
}
