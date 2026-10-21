export const dynamic = "force-dynamic";
import { Probe } from "../../../probe";
export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 1800));
  return <Probe name="jurnal" />;
}
