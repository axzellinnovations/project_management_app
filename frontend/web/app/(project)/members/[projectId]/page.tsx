import MembersPageClient from "./MembersPageClient";

export default async function MembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = await params;
  return <MembersPageClient projectId={resolvedParams.projectId} />;
}
