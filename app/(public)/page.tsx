import { HomeClient } from "@/components/HomeClient";
import { formatWeddingDate, settings } from "@/lib/settings";

export default function Page() {
  return <HomeClient dateLabel={formatWeddingDate()} settings={settings} />;
}
