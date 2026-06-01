import { redirect } from 'next/navigation'

export default function VisualBriefPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/campaigns?movedFrom=visual-brief`)
}
