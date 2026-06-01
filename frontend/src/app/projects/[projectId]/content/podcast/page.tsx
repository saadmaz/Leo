import { redirect } from 'next/navigation'

export default function PodcastPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/content/video-script`)
}
