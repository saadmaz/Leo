import { redirect } from 'next/navigation'

export default function BoardReportPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/reports?tab=board&movedFrom=board-report`)
}
