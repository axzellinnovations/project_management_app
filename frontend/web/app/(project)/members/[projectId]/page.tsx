import MembersPageClient from "./MembersPageClient";

export default async function MembersPage({ params }: { params: { projectId: string } }) {
  const resolvedParams = await params;
  return <MembersPageClient projectId={resolvedParams.projectId} />;
}
