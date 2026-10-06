import { Dashboard } from "@/components/dashboard";
import { getHomepageData } from "@/lib/data";

export const revalidate = 30;

export default async function HomePage() {
  const data = await getHomepageData();
  return <Dashboard {...data} />;
}
