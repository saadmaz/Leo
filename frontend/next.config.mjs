/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    // seo-pro → search (route rename, Phase 3a)
    // These server-side redirects handle any bookmarks or external links to the old paths.
    return [
      {
        source: '/projects/:projectId/seo-pro',
        destination: '/projects/:projectId/search',
        permanent: true,
      },
      {
        source: '/projects/:projectId/seo-pro/:tool',
        destination: '/projects/:projectId/search/:tool',
        permanent: true,
      },
      // deep-search consolidated into intelligence/deep-research
      {
        source: '/projects/:projectId/deep-search',
        destination: '/projects/:projectId/intelligence/deep-research',
        permanent: true,
      },

      // ── Demoted pages (non-permanent so bookmarks get the toast context) ──
      {
        source: '/projects/:projectId/content/translate',
        destination: '/projects/:projectId/library?movedFrom=translate',
        permanent: false,
      },
      {
        source: '/projects/:projectId/content/visual-brief',
        destination: '/projects/:projectId/campaigns?movedFrom=visual-brief',
        permanent: false,
      },
      {
        source: '/projects/:projectId/content/podcast',
        destination: '/projects/:projectId/content/video-script?movedFrom=podcast',
        permanent: false,
      },
      {
        source: '/projects/:projectId/experiments/learning-propagation',
        destination: '/projects/:projectId/experiments/experiment-log?movedFrom=learning-propagation',
        permanent: false,
      },
      {
        source: '/projects/:projectId/analytics-pro/board-report',
        destination: '/projects/:projectId/reports?tab=board&movedFrom=board-report',
        permanent: false,
      },

      // ── Personal Brand consolidation (8 pages → 3) ──
      {
        source: '/projects/:projectId/personal-brand/dashboard',
        destination: '/projects/:projectId/personal-brand?movedFrom=pb-dashboard',
        permanent: false,
      },
      {
        source: '/projects/:projectId/personal-brand/onboarding',
        destination: '/projects/:projectId/personal-brand?movedFrom=pb-onboarding',
        permanent: false,
      },
      {
        source: '/projects/:projectId/personal-brand/analytics',
        destination: '/projects/:projectId/personal-brand?movedFrom=pb-analytics',
        permanent: false,
      },
      {
        source: '/projects/:projectId/personal-brand/publishing',
        destination: '/projects/:projectId/personal-brand/content?tab=schedule&movedFrom=pb-publishing',
        permanent: false,
      },
      {
        source: '/projects/:projectId/personal-brand/calendar',
        destination: '/projects/:projectId/personal-brand/content?tab=posts&movedFrom=pb-calendar',
        permanent: false,
      },
      {
        source: '/projects/:projectId/personal-brand/reputation',
        destination: '/projects/:projectId/personal-brand/content?tab=reputation&movedFrom=pb-reputation',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    // NEXT_PUBLIC_BACKEND_URL should be set to your deployed backend origin in production.
    // e.g. https://leo-api.up.railway.app
    // Falls back to localhost for local development.
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
