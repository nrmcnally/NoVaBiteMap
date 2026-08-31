import { notFound, redirect } from "next/navigation";
import { accountSignInPath, getAccountUser } from "../../lib/account-server";
import { isConfiguredAdmin } from "../../lib/admin-auth";
import { locations } from "../../lib/data";
import { HydrologyGraphClient, type HydrologyNode } from "./HydrologyGraphClient";

export const dynamic = "force-dynamic";

export default async function AdminHydrologyPage() {
  const user = await getAccountUser();
  if (!user) redirect(accountSignInPath("/admin/hydrology"));
  if (!isConfiguredAdmin(user)) notFound();

  const nodes: HydrologyNode[] = locations.map((location, index) => ({
    id: location.id,
    number: index + 1,
    name: location.name,
    waterbody: location.waterbody,
    waterbodyType: location.waterbodyType,
    county: location.county,
    lat: location.lat,
    lng: location.lng,
  }));

  return <HydrologyGraphClient nodes={nodes} adminName={user.displayName} />;
}
