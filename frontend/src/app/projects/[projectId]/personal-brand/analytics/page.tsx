import { redirect } from 'next/navigation'

export default function PersonalBrandAnalyticsPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/personal-brand?movedFrom=pb-analytics`)
}
