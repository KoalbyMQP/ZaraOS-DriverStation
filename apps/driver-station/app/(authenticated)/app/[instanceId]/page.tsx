import { AppPage } from "@/components/app/AppPage";

export default async function AppInterfacePage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ instanceId }, { page }] = await Promise.all([params, searchParams]);
  return (
    <>
      <AppPage key={instanceId} instanceId={instanceId} pageId={Array.isArray(page) ? page[0] : page} />
    </>
  );
}
