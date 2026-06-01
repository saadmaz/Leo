import { redirect } from 'next/navigation'

export default function EmployeeAdvocacyPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/social`)
}
