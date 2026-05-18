// frontend/src/hooks/useTTS.js — PHIÊN BẢN HOÀN CHỈNH
// Web Speech Synthesis: rate 0.8, vi-VN, ưu tiên giọng nữ

import { useState, useCallback, useEffect, useRef } from 'react'

export function useTTS() {
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [voices,      setVoices]      = useState([])
  const [isSupported, setIsSupported] = useState(false)
  const utteranceRef = useRef(null)

  // Load danh sách giọng đọc — Chrome load async, Safari load sync
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    setIsSupported(true)

    function loadVoices() {
      const v = window.speechSynthesis.getVoices()
      if (v.length) setVoices(v)
    }

    loadVoices()
    // Chrome cần event này vì voices load async
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // Chọn giọng đọc tốt nhất cho tiếng Việt
  function pickVoice(voices) {
    // Ưu tiên theo thứ tự:
    // 1. Giọng nữ tiếng Việt (Google)
    // 2. Giọng tiếng Việt bất kỳ
    // 3. Mặc định
    return (
      voices.find(v => v.lang === 'vi-VN' && /female|nu|woman/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('vi') && /google/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('vi')) ||
      null
    )
  }

  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text?.trim()) return

    // Dừng nếu đang đọc câu khác
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance

    // Cấu hình — SRS FR1.5: chậm rãi, dễ nghe cho nông dân lớn tuổi
    utterance.lang   = 'vi-VN'
    utterance.rate   = options.rate   ?? 0.8   // 0.1-10, mặc định 1
    utterance.pitch  = options.pitch  ?? 1.0   // 0-2
    utterance.volume = options.volume ?? 1.0   // 0-1

    const selectedVoice = pickVoice(voices)
    if (selectedVoice) utterance.voice = selectedVoice

    utterance.onstart  = () => setIsSpeaking(true)
    utterance.onend    = () => setIsSpeaking(false)
    utterance.onerror  = (e) => {
      // 'interrupted' xảy ra khi người dùng tự dừng — không phải lỗi
      if (e.error !== 'interrupted') console.warn('[TTS] error:', e.error)
      setIsSpeaking(false)
    }

    // iOS Safari bug: speechSynthesis dừng sau ~15s khi tab không focus
    // Workaround: gọi resume() định kỳ
    const resumeInterval = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume()
    }, 5000)
    utterance.onend   = () => { clearInterval(resumeInterval); setIsSpeaking(false) }
    utterance.onerror = () => { clearInterval(resumeInterval); setIsSpeaking(false) }

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