import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { communityAPI } from '../../services/api'
import { toast } from '../../stores/toastStore'

// Đồng bộ 1 bài vào cả cache chi tiết ['post', id] lẫn feed, để khi quay lại
// feed thấy số like/bình luận đã cập nhật (không bị lệch giữa 2 màn hình).
function patchFeedPost(qc, id, patch) {
  qc.setQueryData(['post', id], p => (p ? { ...p, ...patch } : p))
  qc.setQueryData(['community-feed'], old => {
    if (!old?.pages) return old
    return {
      ...old,
      pages: old.pages.map(pg => ({
        ...pg,
        posts: pg.posts.map(p => (p.id === id ? { ...p, ...patch } : p)),
      })),
    }
  })
}

function bumpCommentCount(qc, id, delta) {
  const cur  = qc.getQueryData(['post', id])
  const next = Math.max(0, Number(cur?.commentCount ?? 0) + delta)
  patchFeedPost(qc, id, { commentCount: next })
}

const ROLE_BADGE = {
  engineer: { label: 'Kỹ sư', bg: '#fdf6f0', color: '#2e1505' },
  admin:    { label: 'Admin', bg: '#eff6ff', color: '#1d4ed8' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const min  = Math.floor(diff / 60000)
  const hr   = Math.floor(diff / 3600000)
  const day  = Math.floor(diff / 86400000)
  if (min < 1)  return 'Vừa xong'
  if (min < 60) return `${min} phút trước`
  if (hr  < 24) return `${hr} giờ trước`
  if (day <  7) return `${day} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

function Avatar({ name, size = 40 }) {
  const initials = (name || 'N').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors   = ['#4B230A', '#0369a1', '#7c3aed', '#b45309', '#be123c']
  const color    = colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28,
                  background: color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 700 }}>{initials}</span>
    </div>
  )
}

export default function PostDetail() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const { user }      = useAuthStore()
  const queryClient   = useQueryClient()
  const inputRef      = useRef()
  const [comment, setComment] = useState('')
  // override like cục bộ; null = dùng giá trị từ post (tránh setState trong effect)
  const [likeOverride, setLikeOverride] = useState(null)

  // Lấy bài từ cache feed nếu có (vào từ feed); nếu không (deep-link / F5 / mở từ
  // notification) thì gọi API. initialData hiển thị ngay khi đã có trong cache.
  const cachedFeed = queryClient.getQueryData(['community-feed'])
  const cachedPost = cachedFeed?.pages?.flatMap(p => p.posts)?.find(p => p.id === id)

  const { data: post, isError } = useQuery({
    queryKey:    ['post', id],
    queryFn:     () => communityAPI.getPost(id).then(r => r.data.post),
    initialData: cachedPost,
    staleTime:   30_000,
  })

  const { data: commentsData, isLoading: loadingComments } = useQuery({
    queryKey: ['comments', id],
    queryFn:  () => communityAPI.getComments(id).then(r => r.data),
    staleTime: 30_000,
  })

  const comments  = commentsData?.comments ?? []
  const liked     = likeOverride?.liked ?? post?.likedByMe ?? false
  const likeCount = likeOverride?.count ?? Number(post?.likeCount ?? 0)

  function handleLike() {
    if (!post) return
    const next      = !liked
    const nextCount = next ? likeCount + 1 : likeCount - 1
    setLikeOverride({ liked: next, count: nextCount })
    patchFeedPost(queryClient, id, { likedByMe: next, likeCount: nextCount })
    communityAPI.toggleLike(id).catch(() => {
      setLikeOverride({ liked: !next, count: likeCount })
      patchFeedPost(queryClient, id, { likedByMe: !next, likeCount })
    })
  }

  const addCommentMutation = useMutation({
    mutationFn: () => communityAPI.addComment(id, comment.trim()).then(r => r.data.comment),
    onSuccess:  (newComment) => {
      setComment('')
      queryClient.setQueryData(['comments', id], old => ({
        comments: [...(old?.comments ?? []), newComment],
      }))
      bumpCommentCount(queryClient, id, +1)
    },
    onError: () => toast.error('Không gửi được bình luận. Thử lại nhé.'),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: commentId => communityAPI.deleteComment(commentId),
    onSuccess:  (_, commentId) => {
      queryClient.setQueryData(['comments', id], old => ({
        comments: (old?.comments ?? []).filter(c => c.id !== commentId),
      }))
      bumpCommentCount(queryClient, id, -1)
    },
    onError: () => toast.error('Không thể xóa bình luận.'),
  })

  function handleDeleteComment(commentId) {
    if (!confirm('Xóa bình luận này?')) return
    deleteCommentMutation.mutate(commentId)
  }

  const badge = ROLE_BADGE[post?.users?.role]

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate(-1)} aria-label="Quay lại"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="flex-1 text-[17px] font-extrabold text-[#0b1c30] m-0">Bài đăng</h1>
      </header>

      <main className="flex-1 flex flex-col pb-28 overflow-y-auto">

        {/* Post */}
        {post ? (
          <div className="bg-white border-b border-[#f1f5f9] p-5 flex flex-col gap-4">
            {/* Author */}
            <div className="flex items-center gap-3">
              <Avatar name={post.users?.name} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[16px] font-bold text-[#0b1c30]">
                    {post.users?.name || 'Nông dân'}
                  </span>
                  {badge && (
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[#64748b] mt-0.5">
                  {post.users?.village && `${post.users.village} · `}{timeAgo(post.created_at)}
                </div>
              </div>
            </div>

            {/* Content */}
            <p className="text-[16px] text-[#0b1c30] leading-relaxed m-0">{post.content}</p>

            {/* Image */}
            {post.image_url && (
              <img src={post.image_url} alt="Ảnh bài đăng"
                className="w-full max-h-80 object-cover rounded-2xl border border-[#f0e0d0]" />
            )}

            {/* Reaction */}
            <div className="flex items-center gap-2 pt-2.5 border-t border-[#f1f5f9]">
              <button onClick={handleLike}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-bold transition-colors"
                style={{
                  background: liked ? '#fff8e8' : '#fdf8f5',
                  color:      liked ? '#855300' : '#64748b',
                  border:     `1.5px solid ${liked ? '#fde68a' : '#f0e0d0'}`,
                }}
                aria-label={liked ? 'Bỏ chúc mừng' : 'Chúc mừng'}>
                <span className="material-symbols-outlined text-[20px]"
                      style={liked ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  thumb_up
                </span>
                Chúc mừng{likeCount > 0 ? ` · ${likeCount}` : ''}
              </button>
              <span className="text-[14px] text-[#64748b] flex items-center gap-1.5 px-2">
                <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                {comments.length} bình luận
              </span>
            </div>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-[#64748b] text-[14px]">
            Không tìm thấy bài đăng. Có thể bài đã bị xóa.
          </div>
        ) : (
          <div className="p-5 text-center text-[#64748b] text-[14px]">Đang tải bài đăng...</div>
        )}

        {/* Comments section */}
        <div className="flex flex-col px-4 pt-4 gap-3">
          <p className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider m-0">
            Bình luận {comments.length > 0 && `(${comments.length})`}
          </p>

          {loadingComments && (
            <p className="text-[13px] text-[#64748b]">Đang tải...</p>
          )}

          {!loadingComments && comments.length === 0 && (
            <p className="text-[14px] text-[#64748b] text-center py-4">
              Chưa có bình luận. Hãy là người đầu tiên!
            </p>
          )}

          {comments.map(c => {
            const isOwn  = c.users?.id === user?.id
            const cbadge = ROLE_BADGE[c.users?.role]
            return (
              <div key={c.id} className="flex items-start gap-2.5">
                <Avatar name={c.users?.name} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="bg-white rounded-2xl rounded-tl-md px-3 py-2.5
                                  border border-[#f0e0d0] shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[13px] font-bold text-[#0b1c30]">
                        {c.users?.name || 'Nông dân'}
                      </span>
                      {cbadge && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: cbadge.bg, color: cbadge.color }}>
                          {cbadge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-[#0b1c30] leading-snug m-0">{c.content}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 pl-1">
                    <span className="text-[11px] text-[#64748b]">{timeAgo(c.created_at)}</span>
                    {isOwn && (
                      <button onClick={() => handleDeleteComment(c.id)}
                        className="text-[11px] text-[#ef4444] font-semibold">
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Comment input — pinned bottom */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px]
                      bg-white border-t border-[#f1f5f9] px-4 py-3
                      shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
           style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-end gap-2">
          <Avatar name={user?.name} size={34} />
          <div className="flex-1 flex items-end gap-2 bg-[#fdf8f5] border border-[#f0e0d0]
                          rounded-2xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (comment.trim()) addCommentMutation.mutate()
                }
              }}
              placeholder="Viết bình luận..."
              rows={1}
              maxLength={500}
              className="flex-1 bg-transparent text-[14px] text-[#0b1c30] resize-none outline-none
                         leading-snug max-h-24"
              style={{ fontFamily: "'Noto Sans', sans-serif" }}
            />
          </div>
          <button
            onClick={() => { if (comment.trim()) addCommentMutation.mutate() }}
            disabled={!comment.trim() || addCommentMutation.isPending}
            className="w-10 h-10 rounded-full bg-[#4B230A] flex items-center justify-center
                       disabled:opacity-40 flex-shrink-0"
            aria-label="Gửi bình luận"
          >
            {addCommentMutation.isPending
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-white text-[18px] ms-fill">send</span>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
