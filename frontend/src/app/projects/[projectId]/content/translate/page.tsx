import { redirect } from 'next/navigation'

export default function TranslatePage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/library`)
}
