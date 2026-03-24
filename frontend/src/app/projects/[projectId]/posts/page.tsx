'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, X, ChevronDown, Flag, Tag, Calendar, User,
  LayoutList, Columns3, Trash2, Pencil, CheckCircle2,
  Clock, Circle, Archive, AlertCircle, Search, CheckSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Post, PostCreate, PostStatus, PostPriority } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES: { value: PostStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'open',        label: 'Open',        icon: <Circle className="w-3.5 h-3.5" />,        color: 'text-blue-500 bg-blue-500/10' },
  { value: 'in_progress', label: 'In Progress', icon: <Clock className="w-3.5 h-3.5" />,         color: 'text-amber-500 bg-amber-500/10' },
  { value: 'done',        label: 'Done',        icon: <CheckCircle2 className="w-3.5 h-3.5" />,  color: 'text-green-500 bg-green-500/10' },
  { value: 'archived',    label: 'Archived',    icon: <Archive className="w-3.5 h-3.5" />,        color: 'text-muted-foreground bg-muted' },
]

const PRIORITIES: { value: PostPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Low',    color: 'text-slate-400' },
  { value: 'medium', label: 'Medium', color: 'text-blue-400' },
  { value: 'high',   label: 'High',   color: 'text-orange-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
]

function priorityColor(p: PostPriority) {
  return PRIORITIES.find((x) => x.value === p)?.color ?? 'text-muted-foreground'
}

function statusMeta(s: PostStatus) {
  return STATUSES.find((x) => x.value === s) ?? STATUSES[0]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function isOverdue(post: Post) {
  if (!post.dueDate) return false
  if (post.status === 'done' || post.status === 'archived') return false
  return new Date(post.dueDate) < new Date(new Date().toDateString())
}

function AssigneeAvatars({ assignees }: { assignees: string[] }) {
  if (!assignees || assignees.length === 0) return null
  const shown = assignees.slice(0, 3)
  const extra = assignees.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((a, i) => (
        <div
          key={i}
          title={a}
          className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[9px] font-bold text-primary uppercase"
        >
          {a[0]}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] text-muted-foreground">
          +{extra}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Post card
// ---------------------------------------------------------------------------

function PostCard({
  post,
  onEdit,
  onDelete,
  onStatusChange,
  selected,
  onToggleSelect,
  bulkMode,
}: {
  post: Post
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: PostStatus) => void
  selected: boolean
  onToggleSelect: () => void
  bulkMode: boolean
}) {
  const [statusOpen, setStatusOpen] = useState(false)
  const meta = statusMeta(post.status)
  const overdue = isOverdue(post)

  return (
    <div
      className={cn(
        'group relative bg-card border rounded-xl p-4 hover:shadow-sm transition-all space-y-2.5',
        selected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30',
        overdue && 'ring-1 ring-red-500/30',
      )}
    >
      {/* Checkbox overlay for bulk select */}
      <div
        className={cn(
          'absolute top-3 left-3 transition-opacity',
          bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <button
          onClick={onToggleSelect}
          className={cn(
            'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
            selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-card',
          )}
        >
          {selected && <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />}
        </button>
      </div>

      {/* Priority + status row */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative">
          <button
            onClick={() => setStatusOpen((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors hover:opacity-80',
              meta.color,
            )}
          >
            {meta.icon}
            {meta.label}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {statusOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-32">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { onStatusChange(s.value); setStatusOpen(false) }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors',
                    s.color,
                  )}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {overdue && (
            <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
              Overdue
            </span>
          )}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Title */}
      <h3 className={cn(
        'text-sm font-medium leading-snug',
        post.status === 'done' && 'line-through text-muted-foreground',
        post.status === 'archived' && 'text-muted-foreground',
      )}>
        {post.title}
      </h3>

      {/* Body preview */}
      {post.body && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{post.body}</p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <Flag className={cn('w-3 h-3', priorityColor(post.priority))} />
        <span className={cn('text-[10px] font-medium', priorityColor(post.priority))}>
          {PRIORITIES.find((p) => p.value === post.priority)?.label}
        </span>

        {post.dueDate && (
          <>
            <span className="text-muted-foreground/40 text-[10px]">·</span>
            <span className={cn(
              'inline-flex items-center gap-1 text-[10px]',
              overdue ? 'text-red-500 font-medium' : 'text-muted-foreground',
            )}>
              <Calendar className="w-2.5 h-2.5" />
              {post.dueDate}
            </span>
          </>
        )}

        {post.tags && post.tags.length > 0 && (
          <>
            <span className="text-muted-foreground/40 text-[10px]">·</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {post.tags[0]}
              {post.tags.length > 1 && ` +${post.tags.length - 1}`}
            </span>
          </>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground/60">{timeAgo(post.createdAt)}</span>
      </div>

      {/* Author + assignees */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <User className="w-2.5 h-2.5 text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground truncate">
            {post.authorName || post.authorEmail}
          </span>
        </div>
        <AssigneeAvatars assignees={post.assignees ?? []} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create / Edit modal
// ---------------------------------------------------------------------------

function PostModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Post>
  onSave: (data: PostCreate) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [status, setStatus] = useState<PostStatus>(initial?.status ?? 'open')
  const [priority, setPriority] = useState<PostPriority>(initial?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '')
  const [tagInput, setTagInput] = useState(initial?.tags?.join(', ') ?? '')
  const [assigneeInput, setAssigneeInput] = useState(initial?.assignees?.join(', ') ?? '')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  function handleSave() {
    if (!title.trim()) { toast.error('Title is required'); return }
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean)
    const assignees = assigneeInput.split(',').map((a) => a.trim()).filter(Boolean)
    onSave({ title: title.trim(), body, status, priority, tags, dueDate: dueDate || undefined, assignees })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">{initial?.id ? 'Edit Post' : 'New Post'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title…"
              className="w-full text-sm bg-transparent border-b border-border focus:border-primary focus:outline-none py-1 font-medium placeholder:text-muted-foreground/50"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add description, details, or content…"
            rows={4}
            className="w-full text-sm bg-muted/30 border border-border rounded-lg p-3 focus:outline-none focus:border-primary resize-none placeholder:text-muted-foreground/50"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PostStatus)}
                className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PostPriority)}
                className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Tags</label>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tag1, tag2…"
                className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Assignees <span className="normal-case font-normal">(comma-separated emails or names)</span>
            </label>
            <input
              value={assigneeInput}
              onChange={(e) => setAssigneeInput(e.target.value)}
              placeholder="alice@co.com, bob@co.com…"
              className="w-full text-xs bg-muted/30 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            {initial?.id ? 'Save changes' : 'Create post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kanban column
// ---------------------------------------------------------------------------

function KanbanColumn({
  status,
  posts,
  onEdit,
  onDelete,
  onStatusChange,
  selectedIds,
  onToggleSelect,
  bulkMode,
}: {
  status: typeof STATUSES[0]
  posts: Post[]
  onEdit: (post: Post) => void
  onDelete: (post: Post) => void
  onStatusChange: (post: Post, s: PostStatus) => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  bulkMode: boolean
}) {
  return (
    <div className="flex flex-col min-w-64 max-w-72 w-72">
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl border border-b-0 border-border bg-muted/30">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', status.color.split(' ')[0])}>
          {status.icon}
          {status.label}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
          {posts.length}
        </span>
      </div>
      <div className="flex-1 border border-border rounded-b-xl bg-muted/10 p-2 space-y-2 min-h-48">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onEdit={() => onEdit(post)}
            onDelete={() => onDelete(post)}
            onStatusChange={(s) => onStatusChange(post, s)}
            selected={selectedIds.has(post.id)}
            onToggleSelect={() => onToggleSelect(post.id)}
            bulkMode={bulkMode}
          />
        ))}
        {posts.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">
            No posts
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// List row
// ---------------------------------------------------------------------------

function ListRow({
  post,
  onEdit,
  onDelete,
  onStatusChange,
  selected,
  onToggleSelect,
  bulkMode,
}: {
  post: Post
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: PostStatus) => void
  selected: boolean
  onToggleSelect: () => void
  bulkMode: boolean
}) {
  const meta = statusMeta(post.status)
  const [statusOpen, setStatusOpen] = useState(false)
  const overdue = isOverdue(post)

  return (
    <div className={cn(
      'group flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors',
      selected && 'bg-primary/5',
      overdue && 'border-l-2 border-l-red-500',
    )}>
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className={cn(
          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
          bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          selected ? 'bg-primary border-primary' : 'border-muted-foreground/40 bg-card',
        )}
      >
        {selected && <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />}
      </button>

      {/* Status */}
      <div className="relative shrink-0">
        <button
          onClick={() => setStatusOpen((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full hover:opacity-80',
            meta.color,
          )}
        >
          {meta.icon}
          {meta.label}
        </button>
        {statusOpen && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-32">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => { onStatusChange(s.value); setStatusOpen(false) }}
                className={cn('flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted', s.color)}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority dot */}
      <AlertCircle className={cn('w-3.5 h-3.5 shrink-0', priorityColor(post.priority))} />

      {/* Title */}
      <span className={cn(
        'flex-1 min-w-0 text-sm truncate',
        post.status === 'done' && 'line-through text-muted-foreground',
        post.status === 'archived' && 'text-muted-foreground',
      )}>
        {post.title}
        {overdue && (
          <span className="ml-2 text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
            Overdue
          </span>
        )}
      </span>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
          {post.tags[0]}
        </span>
      )}

      {/* Assignees */}
      <AssigneeAvatars assignees={post.assignees ?? []} />

      {/* Due date */}
      {post.dueDate && (
        <span className={cn(
          'text-[10px] shrink-0 flex items-center gap-1',
          overdue ? 'text-red-500 font-medium' : 'text-muted-foreground',
        )}>
          <Calendar className="w-2.5 h-2.5" />
          {post.dueDate}
        </span>
      )}

      {/* Author */}
      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
        {post.authorName || post.authorEmail}
      </span>

      {/* Time */}
      <span className="text-[10px] text-muted-foreground/60 shrink-0">{timeAgo(post.createdAt)}</span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PostsPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [showModal, setShowModal] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [filterStatus, setFilterStatus] = useState<PostStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const bulkMode = selectedIds.size > 0

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    api.posts.list(projectId)
      .then(setPosts)
      .catch(() => toast.error('Failed to load posts'))
      .finally(() => setLoading(false))
  }, [projectId])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleBulkStatusChange(status: PostStatus) {
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => {
        const post = posts.find((p) => p.id === id)
        if (!post) return Promise.resolve()
        return api.posts.update(projectId, id, { status })
      }))
      setPosts((prev) => prev.map((p) => selectedIds.has(p.id) ? { ...p, status } : p))
      toast.success(`Updated ${ids.length} post${ids.length !== 1 ? 's' : ''}`)
      clearSelection()
    } catch {
      toast.error('Failed to update posts')
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => api.posts.delete(projectId, id)))
      setPosts((prev) => prev.filter((p) => !selectedIds.has(p.id)))
      toast.success(`Deleted ${ids.length} post${ids.length !== 1 ? 's' : ''}`)
      clearSelection()
    } catch {
      toast.error('Failed to delete posts')
    }
  }

  async function handleCreate(data: PostCreate) {
    try {
      const post = await api.posts.create(projectId, data)
      setPosts((prev) => [post, ...prev])
      setShowModal(false)
      toast.success('Post created')
    } catch {
      toast.error('Failed to create post')
    }
  }

  async function handleUpdate(post: Post, data: PostCreate) {
    try {
      const updated = await api.posts.update(projectId, post.id, data)
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)))
      setEditingPost(null)
      toast.success('Post updated')
    } catch {
      toast.error('Failed to update post')
    }
  }

  async function handleDelete(post: Post) {
    try {
      await api.posts.delete(projectId, post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      toast.success('Post deleted')
    } catch {
      toast.error('Failed to delete post')
    }
  }

  async function handleStatusChange(post: Post, status: PostStatus) {
    try {
      const updated = await api.posts.update(projectId, post.id, { status })
      setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)))
    } catch {
      toast.error('Failed to update status')
    }
  }

  const filtered = posts.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchTitle = p.title.toLowerCase().includes(q)
      const matchTags = p.tags?.some((t) => t.toLowerCase().includes(q))
      if (!matchTitle && !matchTags) return false
    }
    return true
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold">Posts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage tasks, updates, and posts for your team.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or tag…"
              className="pl-8 pr-3 py-1.5 text-xs bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary w-44"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as PostStatus | 'all')}
            className="text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={cn(
                'p-1.5 transition-colors',
                view === 'board' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
              title="Board view"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-1.5 transition-colors',
                view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* New post */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New post
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No posts yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Create posts, tasks, or updates for your team. Track progress with statuses and priorities.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create first post
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            No posts match your search.
          </div>
        ) : view === 'board' ? (
          <div className="flex gap-4 p-6 overflow-x-auto h-full items-start">
            {STATUSES.filter((s) => filterStatus === 'all' || s.value === filterStatus).map((s) => (
              <KanbanColumn
                key={s.value}
                status={s}
                posts={filtered.filter((p) => p.status === s.value)}
                onEdit={setEditingPost}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                bulkMode={bulkMode}
              />
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="w-4" />
              <span className="w-24">Status</span>
              <span className="w-4" />
              <span className="flex-1">Title</span>
              <span className="hidden sm:block w-24">Author</span>
              <span className="w-16">Date</span>
              <span className="w-14" />
            </div>
            {filtered.map((post) => (
              <ListRow
                key={post.id}
                post={post}
                onEdit={() => setEditingPost(post)}
                onDelete={() => handleDelete(post)}
                onStatusChange={(s) => handleStatusChange(post, s)}
                selected={selectedIds.has(post.id)}
                onToggleSelect={() => toggleSelect(post.id)}
                bulkMode={bulkMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="shrink-0 border-t border-border bg-card px-6 py-3 flex items-center gap-3">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => handleBulkStatusChange(s.value)}
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors hover:opacity-80',
                  s.color,
                )}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleBulkDelete()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <PostModal
          onSave={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Edit modal */}
      {editingPost && (
        <PostModal
          initial={editingPost}
          onSave={(data) => handleUpdate(editingPost, data)}
          onClose={() => setEditingPost(null)}
        />
      )}
    </div>
  )
}
