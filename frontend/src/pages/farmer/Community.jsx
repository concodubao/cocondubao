import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { communityAPI } from '../../services/api'
import { toast } from '../../components/Toast'
import BottomNav from '../../components/BottomNav'

const CROP_OPTIONS = [
  { id: 'rice',   label: 'Lúa' },
  { id: 'veggie', label: 'Rau màu' },
  { id: 'fruit',  label: 'Cây ăn trái' },
  { id: 'other',  label: 'Khác' },
]

const ROLE_BADGE = {
  engineer: { label: 'Kỹ sư', bg: '#f0fdf4', color: '#15803d' },
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

function Avatar({ name, role, size = 40 }) {
  const initials = (name || 'N')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#006b2c', '#0369a1', '#7c3aed', '#b45309', '#be123c']
  const color  = colors[(name?.charCodeAt(0) ?? 0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28,
                  background: color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color: '#fff', fontSize: size * 0.38, fontWeight: 700 }}>{initials}</span>
    </div>
  )
}

function PostCard({ post, onLike, onDelete, currentUserId }) {
  const navigate  = useNavigate()
  const badge     = ROLE_BADGE[post.users?.role]
  const isOwn     = post.users?.id === currentUserId
  const [likedByMe,  setLikedByMe]  = useState(post.likedByMe)
  const [likeCount,  setLikeCount]  = useState(Number(post.likeCount))

  function handleLike(e) {
    e.stopPropagation()
    const next = !likedByMe
    setLikedByMe(next)
    setLikeCount(c => next ? c + 1 : c - 1)
    onLike(post.id).catch(() => { setLikedByMe(!next); setLikeCount(c => next ? c - 1 : c + 1) })
  }

  return (
    <div className="bg-white border border-[#e5eeff] rounded-[20px] p-4 flex flex-col gap-3
                    shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99] transition-transform cursor-pointer"
         onClick={() => navigate(`/community/${post.id}`)}>

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Avatar name={post.users?.name} role={post.users?.role} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[15px] font-bold text-[#0b1c30] leading-tight">
              {post.users?.name || 'Nông dân'}
            </span>
            {badge && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="text-[12px] text-[#94a3b8] mt-0.5">
            {post.users?.village && `${post.users.village} · `}{timeAgo(post.created_at)}
          </div>
        </div>
        {isOwn && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(post.id) }}
            aria-label="Xóa bài"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#94a3b8]
                       hover:bg-[#fef2f2] hover:text-[#ef4444] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-[15px] text-[#0b1c30] leading-relaxed m-0 line-clamp-4">{post.content}</p>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="Ảnh bài đăng"
          className="w-full max-h-64 object-cover rounded-2xl border border-[#e5eeff]" />
      )}

      {/* Crop tags */}
      {post.crop_tags?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {post.crop_tags.map(tag => {
            const c = CROP_OPTIONS.find(o => o.id === tag)
            return (
              <span key={tag} className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full
                                         bg-[#f0fdf4] text-[#15803d]">
                #{c?.label || tag}
              </span>
            )
          })}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-4 pt-1 border-t border-[#f1f5f9]">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors"
          style={{ color: likedByMe ? '#ef4444' : '#94a3b8' }}
          aria-label={likedByMe ? 'Bỏ thích' : 'Thích'}
        >
          <span className="material-symbols-outlined text-[18px]"
                style={likedByMe ? { fontVariationSettings: "'FILL' 1" } : {}}>
            favorite
          </span>
          {likeCount > 0 && likeCount}
        </button>

        <button
          onClick={e => { e.stopPropagation(); navigate(`/community/${post.id}`) }}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#94a3b8]"
          aria-label="Bình luận"
        >
          <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
          {post.commentCount > 0 && post.commentCount}
        </button>
      </div>
    </div>
  )
}

// ─── Form đăng bài (bottom sheet) ─────────────────────────────────────────────
function NewPostSheet({ onClose, onPosted }) {
  const fileRef      = useRef()
  const [content,    setContent]    = useState('')
  const [image,      setImage]      = useState(null)
  const [imagePreview, setPreview]  = useState(null)
  const [crops,      setCrops]      = useState([])
  const [loading,    setLoading]    = useState(false)

  function handleImage(e) {
    const f = e.target.files[0]
    if (!f) return
    setImage(f)
    setPreview(URL.createObjectURL(f))
  }

  function toggleCrop(id) {
    setCrops(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSubmit() {
    if (!content.trim()) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('content', content.trim())
      fd.append('cropTags', JSON.stringify(crops))
      if (image) fd.append('image', image)
      const res = await communityAPI.createPost(fd)
      onPosted(res.data.post)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Đăng bài thất bại. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  const remaining = 1000 - content.length

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
         style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-t-[28px] p-5 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto">
        {/* Handle */}
        <div className="w-10 h-1 bg-[#e2e8f0] rounded-full mx-auto" />

        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-[#0b1c30] m-0">Đăng bài mới</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#94a3b8]">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <textarea
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Chia sẻ kinh nghiệm, câu hỏi, hoặc mẹo canh tác với bà con..."
          maxLength={1000}
          rows={4}
          className="w-full p-3 text-[15px] text-[#0b1c30] leading-relaxed border-[1.5px] border-[#e5eeff]
                     rounded-2xl resize-none outline-none focus:border-[#006b2c]"
          style={{ fontFamily: "'Noto Sans', sans-serif" }}
        />
        <div className="text-right text-[12px]"
             style={{ color: remaining < 50 ? '#ef4444' : '#94a3b8' }}>
          {remaining} ký tự còn lại
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="relative">
            <img src={imagePreview} alt="Xem trước" className="w-full max-h-48 object-cover rounded-2xl" />
            <button onClick={() => { setImage(null); setPreview(null) }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Crop tags */}
        <div>
          <p className="text-[13px] text-[#6e7b6c] font-semibold mb-2">Liên quan đến cây trồng nào?</p>
          <div className="flex gap-2 flex-wrap">
            {CROP_OPTIONS.map(c => (
              <button key={c.id} onClick={() => toggleCrop(c.id)}
                className="px-3 py-1.5 text-[13px] font-semibold rounded-full border-[1.5px] transition-all"
                style={{
                  background:   crops.includes(c.id) ? '#f0fdf4' : '#fff',
                  borderColor:  crops.includes(c.id) ? '#16a34a' : '#e5eeff',
                  color:        crops.includes(c.id) ? '#15803d' : '#6e7b6c',
                }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          <button onClick={() => fileRef.current?.click()}
            className="w-11 h-11 rounded-2xl bg-[#f8f9ff] border border-[#e5eeff] flex items-center justify-center text-[#6e7b6c]">
            <span className="material-symbols-outlined text-[22px]">photo_camera</span>
          </button>
          <button onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="flex-1 h-11 bg-[#006b2c] text-white text-[15px] font-bold rounded-2xl
                       disabled:opacity-40 transition-opacity">
            {loading ? 'Đang đăng...' : 'Đăng bài'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Trang Community chính ─────────────────────────────────────────────────────
export default function Community() {
  const { user }      = useAuthStore()
  const queryClient   = useQueryClient()
  const [showCompose, setShowCompose] = useState(false)

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey:  ['community-feed'],
    queryFn:   ({ pageParam = 0 }) =>
      communityAPI.getFeed({ limit: 15, offset: pageParam }).then(r => r.data),
    getNextPageParam: (last, pages) =>
      last.posts.length === 15 ? pages.length * 15 : undefined,
    staleTime: 30_000,
  })

  const posts = data?.pages.flatMap(p => p.posts) ?? []

  const likeMutation = useMutation({
    mutationFn: id => communityAPI.toggleLike(id).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => communityAPI.deletePost(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['community-feed'] }),
    onError:    () => toast.error('Không thể xóa bài. Thử lại nhé.'),
  })

  function handleDelete(id) {
    if (!confirm('Xóa bài đăng này?')) return
    deleteMutation.mutate(id)
  }

  function handlePosted(newPost) {
    queryClient.setQueryData(['community-feed'], old => ({
      ...old,
      pages: old?.pages
        ? [{ posts: [newPost, ...(old.pages[0]?.posts ?? [])] }, ...old.pages.slice(1)]
        : [{ posts: [newPost] }],
    }))
    toast.success('Đã đăng bài thành công!')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f8f9ff] max-w-[480px] mx-auto">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <h1 className="text-[18px] font-extrabold text-[#0b1c30] m-0">Cộng đồng</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 h-9 px-4 bg-[#006b2c] text-white text-[13px] font-bold
                     rounded-full active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
          Đăng bài
        </button>
      </header>

      <main className="flex-1 flex flex-col gap-3 px-4 py-3 pb-24">

        {isLoading && (
          <div className="flex flex-col items-center gap-2 pt-16 text-[#94a3b8]">
            <span className="material-symbols-outlined text-[40px] animate-spin">refresh</span>
            <p className="text-[14px]">Đang tải...</p>
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-16 text-center">
            <span className="material-symbols-outlined text-[56px] text-[#e2e8f0]">groups</span>
            <div>
              <p className="text-[16px] font-bold text-[#0b1c30]">Chưa có bài đăng nào</p>
              <p className="text-[13px] text-[#6e7b6c] mt-1">Hãy là người đầu tiên chia sẻ!</p>
            </div>
            <button onClick={() => setShowCompose(true)}
              className="px-6 py-2.5 bg-[#006b2c] text-white text-[14px] font-bold rounded-full">
              Đăng bài ngay
            </button>
          </div>
        )}

        {posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onLike={id => communityAPI.toggleLike(id).then(r => r.data)}
            onDelete={handleDelete}
            currentUserId={user?.id}
          />
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full py-3 text-[14px] font-semibold text-[#006b2c] bg-white
                       border border-[#e5eeff] rounded-2xl disabled:opacity-60"
          >
            {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm bài viết'}
          </button>
        )}
      </main>

      {showCompose && (
        <NewPostSheet onClose={() => setShowCompose(false)} onPosted={handlePosted} />
      )}

      <BottomNav />
    </div>
  )
}
