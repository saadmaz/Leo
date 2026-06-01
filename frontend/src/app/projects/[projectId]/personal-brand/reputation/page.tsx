import { redirect } from 'next/navigation'

export default function ReputationPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/personal-brand/content?tab=reputation&movedFrom=pb-reputation`)
}
