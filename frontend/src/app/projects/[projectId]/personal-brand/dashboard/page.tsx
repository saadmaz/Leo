import { redirect } from 'next/navigation'

export default function PersonalBrandDashboardPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/personal-brand?movedFrom=pb-dashboard`)
}
