export const dynamic = "force-dynamic";
import { FilterProbe } from "../../../filter-probe";
import { Probe } from "../../../probe";
export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return (
    <>
      <Probe name="jadwal" />
      <FilterProbe />
    </>
  );
}
