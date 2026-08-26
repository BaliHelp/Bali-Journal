'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, AlertTriangle } from 'lucide-react'
import { useLang } from '@/lib/use-lang'

interface Comment {
  id: string
  content: string
  createdAt: Date
  user: { name: string | null; avatar: string | null }
}

interface CommentSectionProps {
  articleId: string
  comments: Comment[]
}

const translations = {
  en: {
    placeholder: 'Write your comment... (minimum 10 characters)',
    genericSendError: 'Failed to submit comment',
    genericError: 'Something went wrong',
    pendingReview: 'Your comment is under review and will appear once approved.',
    sending: 'Sending...',
    send: 'Post Comment',
    empty: 'No comments yet. Be the first!',
    anonymous: 'Anonymous',
  },
  id: {
    placeholder: 'Tulis komentar Anda... (minimal 10 karakter)',
    genericSendError: 'Gagal mengirim komentar',
    genericError: 'Terjadi kesalahan',
    pendingReview: 'Komentar Anda sedang dalam peninjauan dan akan ditampilkan setelah disetujui.',
    sending: 'Mengirim...',
    send: 'Kirim Komentar',
    empty: 'Belum ada komentar. Jadilah yang pertama!',
    anonymous: 'Anonim',
  },
}

export function CommentSection({ articleId, comments: initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const lang = useLang()
  const t = translations[lang]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, articleId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t.genericSendError)
      }

      if (data.status === 'PENDING') {
        setSuccess(true)
        setContent('')
      } else {
        setComments([data.comment, ...comments])
        setContent('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t.placeholder}
          rows={4}
          disabled={loading}
        />

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>
              {t.pendingReview}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={loading || content.length < 10}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t.sending}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t.send}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {t.empty}
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-4 rounded-lg border">
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {comment.user.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{comment.user.name || t.anonymous}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
