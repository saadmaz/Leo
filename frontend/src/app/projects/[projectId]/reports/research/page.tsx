import { redirect } from 'next/navigation'

export default function ResearchReportsPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/reports?tab=research`)
}
