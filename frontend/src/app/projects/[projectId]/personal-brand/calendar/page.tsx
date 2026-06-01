import { redirect } from 'next/navigation'

export default function CalendarPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/personal-brand/content?tab=posts&movedFrom=pb-calendar`)
}
