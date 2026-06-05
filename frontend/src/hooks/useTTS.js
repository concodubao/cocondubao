// frontend/src/hooks/useTTS.js
// Web Speech Synthesis: rate 0.8, vi-VN, ưu tiên giọng nữ

import { useState, useCallback, useEffect, useRef } from 'react'

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

    const utterance = new SpeechSynthesisUtterance(text)
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
