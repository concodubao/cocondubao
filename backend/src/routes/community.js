// backend/src/routes/community.js
// GET  /api/v1/community/feed               — danh sách bài đăng (phân trang)
// POST /api/v1/community/posts              — đăng bài mới (text + ảnh tùy chọn)
// DELETE /api/v1/community/posts/:id        — xóa bài (chủ bài hoặc admin)
// POST /api/v1/community/posts/:id/like     — toggle like
// GET  /api/v1/community/posts/:id/comments — danh sách bình luận
// POST /api/v1/community/posts/:id/comments — thêm bình luận
// DELETE /api/v1/community/comments/:id     — xóa bình luận

import express from 'express'
import multer  from 'multer'
import sharp   from 'sharp'
import { verifyJWT } from '../middleware/auth.js'
import { supabase }  from '../services/supabase.js'

const router = express.Router()

// Trích path trong bucket 'images' từ public URL (để xóa file khi xóa bài/tài khoản)
function storagePathFromUrl(url) {
  if (!url) return null
  const marker = '/object/public/images/'
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Chỉ hỗ trợ file ảnh'))
  },
})

// ─── GET /community/feed ──────────────────────────────────────────────────────
router.get('/feed', verifyJWT, async (req, res) => {
  const { limit = 20, offset = 0, crop } = req.query

  let query = supabase
    .from('posts')
    .select(`
      id, content, image_url, crop_tags, created_at,
      users!posts_user_id_fkey ( id, name, village, role ),
      post_likes ( count ),
      comments   ( count )
    `)
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (crop) query = query.contains('crop_tags', [crop])

  const { data: posts, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Lấy danh sách bài user hiện tại đã like (để hiển thị trạng thái nút)
  const { data: myLikes } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', req.user.userId)

  const likedSet = new Set((myLikes || []).map(l => l.post_id))

  const result = (posts || []).map(p => ({
    ...p,
    likeCount:    p.post_likes?.[0]?.count ?? 0,
    commentCount: p.comments?.[0]?.count   ?? 0,
    likedByMe:    likedSet.has(p.id),
    post_likes:   undefined,
    comments:     undefined,
  }))

  res.json({ posts: result })
})

// ─── GET /community/posts/:id — lấy 1 bài (deep-link / F5 / mở từ notification) ─
router.get('/posts/:id', verifyJWT, async (req, res) => {
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      id, content, image_url, crop_tags, created_at,
      users!posts_user_id_fkey ( id, name, village, role ),
      post_likes ( count ),
      comments   ( count )
    `)
    .eq('id', req.params.id)
    .single()

  if (error || !post) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' })

  const { data: myLike } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', post.id)
    .eq('user_id', req.user.userId)
    .maybeSingle()

  res.json({
    post: {
      ...post,
      likeCount:    post.post_likes?.[0]?.count ?? 0,
      commentCount: post.comments?.[0]?.count   ?? 0,
      likedByMe:    !!myLike,
      post_likes:   undefined,
      comments:     undefined,
    },
  })
})

// ─── POST /community/posts ────────────────────────────────────────────────────
router.post('/posts', verifyJWT,
  (req, res, next) => {
    upload.single('image')(req, res, err => {
      if (err) return res.status(400).json({ error: err.message })
      next()
    })
  },
  async (req, res) => {
    const { content, cropTags } = req.body
    if (!content?.trim())       return res.status(400).json({ error: 'Nội dung không được để trống.' })
    if (content.length > 1000)  return res.status(400).json({ error: 'Bài viết tối đa 1000 ký tự.' })

    let imageUrl = null
    if (req.file) {
      try {
        let buf = await sharp(req.file.buffer)
          .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer()

        if (buf.length > 500 * 1024) {
          buf = await sharp(buf).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 65 }).toBuffer()
        }

        const fileName = `community/${req.user.userId}/${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(fileName, buf, { contentType: 'image/jpeg', upsert: false })

        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('images').getPublicUrl(fileName)
        imageUrl = data.publicUrl
      } catch (err) {
        return res.status(500).json({ error: 'Upload ảnh thất bại: ' + err.message })
      }
    }

    let tags = []
    try { tags = JSON.parse(cropTags || '[]') } catch {}

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id:   req.user.userId,
        content:   content.trim(),
        image_url: imageUrl,
        crop_tags: tags,
      })
      .select(`
        id, content, image_url, crop_tags, created_at,
        users!posts_user_id_fkey ( id, name, village, role )
      `)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    res.json({ post: { ...post, likeCount: 0, commentCount: 0, likedByMe: false } })
  }
)

// ─── DELETE /community/posts/:id ─────────────────────────────────────────────
router.delete('/posts/:id', verifyJWT, async (req, res) => {
  const { data: post } = await supabase
    .from('posts').select('user_id, image_url').eq('id', req.params.id).single()

  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài đăng.' })
  if (req.user.role !== 'admin' && post.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Không có quyền xóa bài này.' })
  }

  const { error } = await supabase.from('posts').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })

  // Xóa luôn ảnh trong storage để khỏi rác bucket (best-effort, không chặn response)
  const path = storagePathFromUrl(post.image_url)
  if (path) supabase.storage.from('images').remove([path]).catch(() => {})

  res.json({ success: true })
})

// ─── POST /community/posts/:id/like — toggle like ─────────────────────────────
router.post('/posts/:id/like', verifyJWT, async (req, res) => {
  const postId = req.params.id
  const userId = req.user.userId

  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase.from('post_likes').delete()
      .eq('post_id', postId).eq('user_id', userId)
    res.json({ liked: false })
  } else {
    const { error } = await supabase.from('post_likes')
      .insert({ post_id: postId, user_id: userId })
    if (error) return res.status(500).json({ error: error.message })
    res.json({ liked: true })
  }
})

// ─── GET /community/posts/:id/comments ───────────────────────────────────────
router.get('/posts/:id/comments', verifyJWT, async (req, res) => {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      id, content, created_at,
      users!comments_user_id_fkey ( id, name, role )
    `)
    .eq('post_id', req.params.id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ comments: data || [] })
})

// ─── POST /community/posts/:id/comments ──────────────────────────────────────
router.post('/posts/:id/comments', verifyJWT, async (req, res) => {
  const { content } = req.body
  if (!content?.trim())      return res.status(400).json({ error: 'Bình luận không được để trống.' })
  if (content.length > 500)  return res.status(400).json({ error: 'Bình luận tối đa 500 ký tự.' })

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: req.params.id, user_id: req.user.userId, content: content.trim() })
    .select(`
      id, content, created_at,
      users!comments_user_id_fkey ( id, name, role )
    `)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ comment: data })
})

// ─── DELETE /community/comments/:id ──────────────────────────────────────────
router.delete('/comments/:id', verifyJWT, async (req, res) => {
  const { data: comment } = await supabase
    .from('comments').select('user_id').eq('id', req.params.id).single()

  if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận.' })
  if (req.user.role !== 'admin' && comment.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Không có quyền xóa bình luận này.' })
  }

  const { error } = await supabase.from('comments').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
