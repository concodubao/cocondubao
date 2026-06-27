// frontend/src/hooks/useTTS.js
// Web Speech Synthesis: rate 0.8, vi-VN, ưu tiên giọng nữ

import { useState, useCallback, useEffect, useRef } from 'react'

// ─── Chuẩn hoá text trước khi đọc ───────────────────────────────────────────
// Giọng vi-VN đọc viết tắt/từ tiếng Anh (NPK, pH, kg, AI...) theo âm tiếng Việt
// nên sai. Web Speech API không trộn được nhiều giọng trong 1 câu, nên ta phiên
// âm sang cách bà con quen đọc + đánh vần các viết tắt còn lại. Tất cả on-device.

// Tên chữ cái tiếng Việt — đánh vần viết tắt IN HOA chưa có trong từ điển riêng.
const VN_LETTER = {
  A: 'a',  B: 'bê', C: 'xê', D: 'dê', E: 'e',  F: 'ép', G: 'gờ', H: 'hắt',
  I: 'i',  J: 'di', K: 'ca', L: 'lờ', M: 'mờ', N: 'nờ', O: 'ô',  P: 'pê',
  Q: 'quy', R: 'rờ', S: 'ét', T: 'tê', U: 'u',  V: 'vê', W: 'vê kép', X: 'ích',
  Y: 'i',  Z: 'dét',
}

// Lớp "không phải chữ cái" — gồm cả chữ tiếng Việt có dấu (À-ỹ). JS `\b` chỉ tính
// chữ ASCII nên dấu tiếng Việt (à, í...) phá ranh giới từ → phải tự định ranh giới.
// Dùng lookahead + nhóm bắt ký tự trước (KHÔNG dùng lookbehind — iOS cũ chưa hỗ trợ).
const NL = '[^A-Za-zÀ-ỹ]' // non-letter (kể cả số, dấu câu, khoảng trắng)

// Từ/viết tắt hay gặp trong nông nghiệp → phiên âm sát cách đọc thực tế.
const SPEECH_DICT = [
  [/\bNPK\b/gi,        'en pê ka'],
  [/\bDAP\b/gi,        'đê a pê'],
  [/\bKCl\b/gi,        'ka xê lờ'],
  [/\bpH\b/g,          'pê hắt'],
  [/\bAI\b/g,          'ây ai'],
  [/\bSMS\b/gi,        'tin nhắn'],
  [/vitamin/gi,        'vi ta min'],
  // Đơn vị — "5kg" lẫn "5 kg" đều ra "5 ki lô gam" (giữ ký tự đứng trước qua $1)
  [new RegExp(`(^|${NL})kg(?![A-Za-zÀ-ỹ])`, 'gi'), '$1 ki lô gam'],
  [new RegExp(`(^|${NL})ha(?![A-Za-zÀ-ỹ])`, 'gi'), '$1 héc ta'],
  [new RegExp(`(^|${NL})ml(?![A-Za-zÀ-ỹ])`, 'gi'), '$1 mi li lít'],
  [new RegExp(`(^|${NL})cc(?![A-Za-zÀ-ỹ])`, 'gi'), '$1 xi xi'],
  // g / l chỉ đổi khi đứng ngay sau số (tránh đụng "là", "lít", "trồng"...)
  [/(\d)\s*g(?![A-Za-zÀ-ỹ])/g, '$1 gam'],
  [/(\d)\s*l(?![A-Za-zÀ-ỹ])/g, '$1 lít'],
  [/\bm2\b/gi,         'mét vuông'],
  [/m²/g,             'mét vuông'],
  [/°\s*C/gi,          ' độ xê'],
  [/ºC/g,             ' độ xê'],
  [/%/g,              ' phần trăm'],
]

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')      // **đậm**
    .replace(/\*(.+?)\*/g, '$1')           // *nghiêng*
    .replace(/`(.+?)`/g, '$1')             // `code`
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')    // [chữ](link)
    .replace(/^#{1,6}\s*/gm, '')           // # tiêu đề
    .replace(/^[\s]*[-•*]\s+/gm, '')       // gạch đầu dòng
    .replace(/^\s*\d+\.\s+/gm, '')         // "1." "2." (đọc số thứ tự gây rối; xuống dòng tạo ngắt nghỉ)
}

export function normalizeForSpeech(text) {
  if (!text) return ''
  let out = stripMarkdown(text)
  for (const [re, rep] of SPEECH_DICT) out = out.replace(re, rep)
  // Đánh vần viết tắt IN HOA còn lại (2-5 chữ): "USDA" → "u ét dê a"
  out = out.replace(/\b[A-Z]{2,5}\b/g, m =>
    m.split('').map(ch => VN_LETTER[ch] || ch).join(' '))
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim()
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices,     setVoices]     = useState([])
  // Khả năng trình duyệt — cố định lúc mount, không đổi khi chạy
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const utteranceRef = useRef(null)

  // Load danh sách giọng đọc — Chrome load async, Safari load sync
  useEffect(() => {
    if (!isSupported) return

    function loadVoices() {
      const v = window.speechSynthesis.getVoices()
      if (v.length) setVoices(v)
    }

    loadVoices()
    // Chrome cần event này vì voices load async
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [isSupported])

  function pickVoice(voices) {
    return (
      voices.find(v => v.lang === 'vi-VN' && /female|nu|woman/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('vi') && /google/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('vi')) ||
      null
    )
  }

  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text?.trim()) return

    window.speechSynthesis.cancel()

    // Phiên âm viết tắt/từ tiếng Anh + bóc markdown để giọng vi-VN đọc đúng hơn
    const spoken = normalizeForSpeech(text)
    if (!spoken) return

    const utterance = new SpeechSynthesisUtterance(spoken)
    utteranceRef.current = utterance

    utterance.lang   = 'vi-VN'
    utterance.rate   = options.rate   ?? 0.8
    utterance.pitch  = options.pitch  ?? 1.0
    utterance.volume = options.volume ?? 1.0

    const selectedVoice = pickVoice(voices)
    if (selectedVoice) utterance.voice = selectedVoice

    // iOS Safari bug: speechSynthesis dừng sau ~15s khi tab không focus
    const resumeInterval = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume()
    }, 5000)

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => { clearInterval(resumeInterval); setIsSpeaking(false) }
    utterance.onerror = (e) => {
      clearInterval(resumeInterval)
      if (e.error !== 'interrupted') console.warn('[TTS] error:', e.error)
      setIsSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }, [isSupported, voices])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  const pause = useCallback(() => {
    window.speechSynthesis.pause()
    setIsSpeaking(false)
  }, [])

  const resume = useCallback(() => {
    window.speechSynthesis.resume()
    setIsSpeaking(true)
  }, [])

  return { speak, stop, pause, resume, isSpeaking, isSupported, voices }
}
