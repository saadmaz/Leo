import { redirect } from 'next/navigation'

export default function PublishingPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/personal-brand/content?tab=schedule&movedFrom=pb-publishing`)
}
