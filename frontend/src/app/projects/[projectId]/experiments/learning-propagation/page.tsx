import { redirect } from 'next/navigation'

export default function LearningPropagationPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/experiments/experiment-log`)
}
