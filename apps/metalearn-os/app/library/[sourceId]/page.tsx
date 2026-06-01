import { MetaLearnOSPage } from "../../workspace";

export default async function Page({ params }: { params: Promise<{ sourceId: string }> }) {
  const { sourceId } = await params;
  return <MetaLearnOSPage view="library" sourceId={decodeURIComponent(sourceId)} />;
}
