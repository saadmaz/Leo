import { redirect } from 'next/navigation'

export default function PersonalBrandOnboardingPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/personal-brand?movedFrom=pb-onboarding`)
}
