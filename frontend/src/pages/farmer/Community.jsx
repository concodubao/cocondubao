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

function Avatar({ name, role, size = 40 }) {
  const initials = (name || 'N')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#4B230A', '#0369a1', '#7c3aed', '#b45309', '#be123c']
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
    <div className="bg-white border border-[#f0e0d0] rounded-[20px] p-4 flex flex-col gap-3
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
          className="w-full max-h-64 object-cover rounded-2xl border border-[#f0e0d0]" />
      )}

      {/* Crop tags */}
      {post.crop_tags?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {post.crop_tags.map(tag => {
            const c = CROP_OPTIONS.find(o => o.id === tag)
            return (
              <span key={tag} className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full
                                         bg-[#fdf6f0] text-[#2e1505]">
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

// ─── Form đăng bài — fullscreen overlay, submit ở header ────────────────────
function NewPostSheet({ onClose, onPosted, user }) {
  const fileRef        = useRef()
  const textareaRef    = useRef()
  const [content,      setContent]    = useState('')
  const [image,        setImage]      = useState(null)
  const [imagePreview, setPreview]    = useState(null)
  const [crops,        setCrops]      = useState([])
  const [loading,      setLoading]    = useState(false)

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
    if (!content.trim() || loading) return
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
  const canPost   = content.trim().length > 0

  // Avatar initials
  const initials = (user?.name || 'N').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const avatarColor = ['#4B230A','#0369a1','#7c3aed','#b45309','#be123c']
  const aColor = avatarColor[(user?.name?.charCodeAt(0) ?? 0) % avatarColor.length]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white max-w-[480px] mx-auto"
         style={{ animation: 'slideUp 0.22s cubic-bezier(0.32,0.72,0,1)' }}>

      {/* ── Header — nút Hủy (trái) + tiêu đề (giữa) + nút Đăng (phải) ── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#f1f5f9] flex-shrink-0">
        <button onClick={onClose}
          className="text-[15px] font-semibold text-[#7a6358] py-1 px-2 -ml-2">
          Hủy
        </button>
        <span className="text-[16px] font-extrabold text-[#0b1c30]">Đăng bài mới</span>
        <button
          onClick={handleSubmit}
          disabled={!canPost || loading}
          className="h-9 px-5 rounded-full text-[14px] font-bold transition-all"
          style={{
            background: canPost && !loading ? '#4B230A' : '#f0e0d0',
            color:      canPost && !loading ? '#fff' : '#94a3b8',
          }}>
          {loading ? 'Đăng...' : 'Đăng'}
        </button>
      </header>

      {/* ── Nội dung cuộn được ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Author row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
               style={{ background: aColor }}>
            <span className="text-white text-[16px] font-bold">{initials}</span>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#0b1c30]">{user?.name || 'Bạn'}</div>
            {user?.village && <div className="text-[12px] text-[#94a3b8]">{user.village}</div>}
          </div>
        </div>

        {/* Textarea — no border, feels native */}
        <textarea
          ref={textareaRef}
          autoFocus
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Chia sẻ kinh nghiệm, câu hỏi, hoặc mẹo canh tác với bà con..."
          maxLength={1000}
          className="w-full px-4 py-2 text-[16px] text-[#0b1c30] leading-relaxed
                     resize-none outline-none bg-white min-h-[140px]"
          style={{ fontFamily: "'Noto Sans', sans-serif" }}
        />

        {/* Char count */}
        <div className="px-4 pb-2 text-right">
          <span className="text-[12px]" style={{ color: remaining < 50 ? '#ef4444' : '#c4a898' }}>
            {remaining}
          </span>
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="relative mx-4 mb-3">
            <img src={imagePreview} alt="Ảnh xem trước"
              className="w-full max-h-56 object-cover rounded-2xl border border-[#f0e0d0]" />
            <button onClick={() => { setImage(null); setPreview(null) }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full
                         flex items-center justify-center backdrop-blur-sm">
              <span className="material-symbols-outlined text-white text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="mx-4 border-t border-[#f1f5f9] my-2" />

        {/* Crop tags */}
        <div className="px-4 pb-3">
          <p className="text-[13px] font-bold text-[#7a6358] mb-2.5">Thẻ cây trồng</p>
          <div className="flex gap-2 flex-wrap">
            {CROP_OPTIONS.map(c => {
              const active = crops.includes(c.id)
              return (
                <button key={c.id} onClick={() => toggleCrop(c.id)}
                  className="px-3 py-1.5 text-[13px] font-semibold rounded-full border-[1.5px] transition-all"
                  style={{
                    background:  active ? '#fdf6f0' : '#fdf8f5',
                    borderColor: active ? '#4B230A' : '#f0e0d0',
                    color:       active ? '#2e1505' : '#7a6358',
                  }}>
                  {active && '✓ '}{c.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Toolbar dưới cùng — không bị keyboard che vì ở đây không dùng fixed ── */}
      <div className="border-t border-[#f1f5f9] px-4 py-3 flex items-center gap-3 flex-shrink-0"
           style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#4B230A]
                     px-3 py-2 rounded-xl bg-[#fdf6f0]">
          <span className="material-symbols-outlined text-[18px]">photo_camera</span>
          {image ? 'Đổi ảnh' : 'Thêm ảnh'}
        </button>
        {image && (
          <button onClick={() => { setImage(null); setPreview(null) }}
            className="text-[12px] text-[#94a3b8] underline">
            Xóa ảnh
          </button>
        )}
      </div>

      <style>{`@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
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
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <h1 className="text-[18px] font-extrabold text-[#0b1c30] m-0">Cộng đồng</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 h-9 px-4 bg-[#4B230A] text-white text-[13px] font-bold
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
              <p className="text-[13px] text-[#7a6358] mt-1">Hãy là người đầu tiên chia sẻ!</p>
            </div>
            <button onClick={() => setShowCompose(true)}
              className="px-6 py-2.5 bg-[#4B230A] text-white text-[14px] font-bold rounded-full">
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
            className="w-full py-3 text-[14px] font-semibold text-[#4B230A] bg-white
                       border border-[#f0e0d0] rounded-2xl disabled:opacity-60"
          >
            {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm bài viết'}
          </button>
        )}
      </main>

      {showCompose && (
        <NewPostSheet onClose={() => setShowCompose(false)} onPosted={handlePosted} user={user} />
      )}

      <BottomNav />
    </div>
  )
}
