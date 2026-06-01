'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Video, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { SSEFeaturePage } from '@/components/pillar1/SSEFeaturePage'
import { api } from '@/lib/api'
import { usePillar2Store } from '@/stores/pillar2-store'
import { cn } from '@/lib/utils'
import type { VideoScriptPayload, PodcastPayload, ProgressStep } from '@/types'

const VIDEO_PLATFORMS = ['YouTube', 'TikTok', 'LinkedIn', 'Instagram Reels', 'Twitter/X']

type ScriptType = 'video' | 'podcast'

export default function LongFormScriptsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const store = usePillar2Store()
  const abortRef = useRef<AbortController | null>(null)

  const [scriptType, setScriptType] = useState<ScriptType>('video')

  // Video state
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState('YouTube')
  const [duration, setDuration] = useState(3)
  const [cta, setCta] = useState('')
  const [videoResult, setVideoResult] = useState<VideoScriptPayload | null>(null)

  // Podcast state
  const [podcastMode, setPodcastMode] = useState<'url' | 'transcript'>('transcript')
  const [audioUrl, setAudioUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [speakers, setSpeakers] = useState('')
  const [podcastResult, setPodcastResult] = useState<PodcastPayload | null>(null)

  function resetAll(): AbortController {
    store.setIsStreaming(true)
    store.clearSteps()
    store.clearStreamText()
    setVideoResult(null)
    setPodcastResult(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    return ctrl
  }

  async function generateVideo() {
    if (!topic.trim()) { toast.error('Topic is required'); return }
    const ctrl = resetAll()
    try {
      await api.pillar2.streamVideoScript(projectId,
        { topic: topic.trim(), platform, duration_minutes: duration, cta: cta || undefined, include_broll: true },
        {
          onStep: (step, label, status) => store.upsertStep(step, label, status as ProgressStep['status']),
          onDelta: (text) => store.appendStreamText(text),
          onSaved: (_id, payload) => { setVideoResult(payload as unknown as VideoScriptPayload); store.clearStreamText(); store.setIsStreaming(false); toast.success('Script ready!') },
          onError: (msg) => { toast.error(msg); store.setIsStreaming(false) },
          onDone: () => store.setIsStreaming(false),
        },
        ctrl.signal,
      )
    } catch { store.setIsStreaming(false) }
  }

  async function generatePodcast() {
    if (podcastMode === 'url' && !audioUrl.trim()) { toast.error('Audio URL is required'); return }
    if (podcastMode === 'transcript' && !transcript.trim()) { toast.error('Transcript is required'); return }
    const ctrl = resetAll()
    const speakerList = speakers.split(',').map((s) => s.trim()).filter(Boolean)
    try {
      await api.pillar2.streamPodcast(projectId,
        {
          audio_url: podcastMode === 'url' ? audioUrl.trim() : undefined,
          transcript: podcastMode === 'transcript' ? transcript.trim() : undefined,
          episode_title: episodeTitle.trim() || undefined,
          speaker_names: speakerList.length > 0 ? speakerList : undefined,
        },
        {
          onStep: (step, label, status) => store.upsertStep(step, label, status as ProgressStep['status']),
          onDelta: (text) => store.appendStreamText(text),
          onSaved: (_id, payload) => { setPodcastResult(payload as unknown as PodcastPayload); store.clearStreamText(); store.setIsStreaming(false); toast.success('Show notes ready!') },
          onError: (msg) => { toast.error(msg); store.setIsStreaming(false) },
          onDone: () => store.setIsStreaming(false),
        },
        ctrl.signal,
      )
    } catch { store.setIsStreaming(false) }
  }

  // ── Video form ──────────────────────────────────────────────────────────────

  const videoForm = (
    <>
      <div className="flex rounded-lg border border-border overflow-hidden">
        {(['video', 'podcast'] as ScriptType[]).map((t) => (
          <button key={t} onClick={() => setScriptType(t)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
              scriptType === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
            {t === 'video' ? <Video className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {t === 'video' ? 'Video Script' : 'Podcast Show Notes'}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Topic *</label>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2}
          placeholder="e.g. '5 ways AI is changing content marketing in 2026'"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
            {VIDEO_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</label>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary">
            {[1, 2, 3, 5, 8, 10, 15, 20].map((n) => <option key={n} value={n}>{n} min</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">CTA Goal (optional)</label>
        <input value={cta} onChange={(e) => setCta(e.target.value)}
          placeholder="e.g. Subscribe, Visit leoagent.online, Book a demo"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
    </>
  )

  // ── Podcast form ────────────────────────────────────────────────────────────

  const podcastForm = (
    <>
      <div className="flex rounded-lg border border-border overflow-hidden">
        {(['video', 'podcast'] as ScriptType[]).map((t) => (
          <button key={t} onClick={() => setScriptType(t)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
              scriptType === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
            {t === 'video' ? <Video className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {t === 'video' ? 'Video Script' : 'Podcast Show Notes'}
          </button>
        ))}
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden">
        {(['transcript', 'url'] as const).map((m) => (
          <button key={m} onClick={() => setPodcastMode(m)}
            className={cn('flex-1 py-2 text-xs font-medium transition-colors',
              podcastMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
            {m === 'transcript' ? 'Paste Transcript' : 'Audio URL (Whisper)'}
          </button>
        ))}
      </div>

      {podcastMode === 'url' ? (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Audio URL * (mp3, mp4, wav, m4a)</label>
          <input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://example.com/episode.mp3"
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
          <p className="text-xs text-muted-foreground mt-1">Requires OPENAI_API_KEY ($0.006/min audio)</p>
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transcript *</label>
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={6}
            placeholder="Paste your podcast transcript here..."
            className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Episode Title (optional)</label>
        <input value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)}
          placeholder="e.g. #42 - How AI is Changing Marketing"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Speakers (optional, comma-separated)</label>
        <input value={speakers} onChange={(e) => setSpeakers(e.target.value)}
          placeholder="e.g. John Smith, Jane Doe"
          className="mt-1 w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
    </>
  )

  // ── Result nodes ────────────────────────────────────────────────────────────

  const videoResultNode = videoResult ? (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="font-semibold text-sm">{videoResult.title}</h2>
        {videoResult.estimated_duration && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{videoResult.estimated_duration}</span>
        )}
      </div>
      {videoResult.hook && (
        <div className="p-3 rounded-lg bg-primary/10 text-primary text-sm">
          <span className="font-medium text-xs uppercase tracking-wide block mb-1">Hook</span>
          {videoResult.hook}
        </div>
      )}
      {videoResult.sections?.map((s, i) => (
        <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{s.timestamp}</span>
            <span className="font-semibold text-sm">{s.section_title}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.script}</p>
          {s.broll && <p className="text-xs text-muted-foreground/70 italic">📹 B-Roll: {s.broll}</p>}
          {s.notes && <p className="text-xs text-muted-foreground/70">📝 {s.notes}</p>}
        </div>
      ))}
      {videoResult.cta && (
        <div className="p-3 rounded-lg border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">CTA</p>
          <p className="text-sm">{videoResult.cta}</p>
        </div>
      )}
      {videoResult.tags && videoResult.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {videoResult.tags.map((t, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">#{t}</span>
          ))}
        </div>
      )}
    </div>
  ) : null

  const podcastResultNode = podcastResult ? (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm">{podcastResult.episode_title}</h2>
      <div className="p-4 rounded-xl border border-border bg-card">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary</p>
        <p className="text-sm text-muted-foreground">{podcastResult.summary}</p>
      </div>
      {podcastResult.key_takeaways?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Takeaways</p>
          {podcastResult.key_takeaways.map((t, i) => (
            <p key={i} className="text-sm text-muted-foreground">• {t}</p>
          ))}
        </div>
      )}
      {podcastResult.timestamps?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Timestamps</p>
          {podcastResult.timestamps.map((t, i) => (
            <p key={i} className="text-xs text-muted-foreground font-mono">{t.time} - {t.topic}</p>
          ))}
        </div>
      )}
      {podcastResult.notable_quotes?.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notable Quotes</p>
          {podcastResult.notable_quotes.map((q, i) => (
            <blockquote key={i} className="border-l-2 border-primary pl-3">
              <p className="text-sm italic">&ldquo;{q.quote}&rdquo;</p>
              <p className="text-xs text-muted-foreground mt-0.5">- {q.speaker}</p>
            </blockquote>
          ))}
        </div>
      )}
      {podcastResult.platform_description && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Platform Description</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{podcastResult.platform_description}</p>
        </div>
      )}
      {podcastResult.linkedin_post && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">LinkedIn Post</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{podcastResult.linkedin_post}</p>
        </div>
      )}
    </div>
  ) : null

  const isVideo = scriptType === 'video'
  const canSubmit = isVideo
    ? !!topic.trim()
    : podcastMode === 'url' ? !!audioUrl.trim() : !!transcript.trim()

  return (
    <SSEFeaturePage
      projectId={projectId}
      title="Long-form Scripts"
      subtitle={isVideo ? 'Video scriptwriting · Claude' : 'Podcast show notes · Whisper + Claude'}
      icon={isVideo ? <Video className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      credits={isVideo ? 15 : 20}
      steps={store.steps}
      isStreaming={store.isStreaming}
      streamText={store.streamText}
      form={isVideo ? videoForm : podcastForm}
      result={isVideo ? videoResultNode : podcastResultNode}
      onSubmit={isVideo ? generateVideo : generatePodcast}
      submitLabel={isVideo ? 'Write Script - 15 credits' : 'Generate Show Notes - 20 credits'}
      canSubmit={canSubmit}
    />
  )
}
