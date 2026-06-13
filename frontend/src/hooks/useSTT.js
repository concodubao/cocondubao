// frontend/src/hooks/useSTT.js — PHIÊN BẢN HOÀN CHỈNH
// Xử lý đầy đủ: Web Speech API + fallback Google STT + MediaRecorder cho iOS

import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'

// ─── Detect môi trường ────────────────────────────────────────────────────────
// iPadOS 13+ báo UA là "Macintosh" → bổ sung check maxTouchPoints để bắt iPad.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// Safari thật (loại trừ Chrome/Edge/Firefox/Opera trên iOS lẫn desktop)
const isSafari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(navigator.userAgent)
const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

// Web Speech API CHỈ dùng cho Chromium (Chrome desktop/Android, Edge). Safari —
// cả iOS, iPadOS lẫn macOS — tuy có webkitSpeechRecognition nhưng hay lỗi
// 'network'/im lặng không nhận giọng → ép dùng fallback MediaRecorder + Gemini STT.
const USE_WEB_SPEECH = hasWebSpeech && !isIOS && !isSafari

export function useSTT() {
  const [transcript,    setTranscript]    = useState('')
  const [interimText,   setInterimText]   = useState('') // text tạm khi đang nói
  const [isListening,   setIsListening]   = useState(false)
  const [isProcessing,  setIsProcessing]  = useState(false) // đang gọi Google STT
  const [error,         setError]         = useState(null)
  const [volume,        setVolume]        = useState(0)    // 0-100 cho visualizer sóng âm

  const recognitionRef  = useRef(null)
  const mediaRecRef     = useRef(null) // MediaRecorder cho iOS fallback
  const audioChunksRef  = useRef([])
  const animFrameRef    = useRef(null)
  const analyserRef     = useRef(null)
  const timeoutRef      = useRef(null)

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      stopAll()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // ─── Volume analyser (dùng cho cả 2 mode) ───────────────────────────────────
  async function startVolumeAnalyser(stream) {
    try {
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)

      function tick() {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        // Scale 0-255 → 0-100, nhân 2.5 để khuếch đại cho dễ nhìn
        setVolume(Math.min(100, Math.round(avg * 2.5)))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // AudioContext có thể bị block trên một số thiết bị → bỏ qua
    }
  }

  function stopVolumeAnalyser() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setVolume(0)
  }

  // ─── MODE 1: Web Speech API (Chrome Android, Desktop) ───────────────────────
  function startWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.lang             = 'vi-VN'
    recognition.continuous       = false   // Dừng sau câu hoàn chỉnh
    recognition.interimResults   = true    // Hiện text tạm khi đang nói
    recognition.maxAlternatives  = 1

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
      setTranscript('')
      setInterimText('')
    }

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) final += text
        else interim += text
      }

      if (final)   setTranscript(prev => prev + final)
      if (interim) setInterimText(interim)
    }

    recognition.onerror = (event) => {
      console.error('[STT] Web Speech error:', event.error)
      setIsListening(false)
      stopVolumeAnalyser()

      const errorMessages = {
        'not-allowed':    'Bạn chưa cho phép dùng micro. Nhấn "Cho phép" khi trình duyệt hỏi.',
        'no-speech':      'Không nghe thấy gì. Thử nói to hơn nhé.',
        'audio-capture':  'Không tìm thấy micro. Kiểm tra thiết bị nhé.',
        'network':        'Mạng yếu, không nhận dạng được giọng nói. Thử lại nhé.',
        'aborted':        null, // Người dùng tự dừng → không hiện lỗi
      }
      const msg = errorMessages[event.error]
      if (msg) setError(msg)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimText('')
      stopVolumeAnalyser()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    recognition.start()

    // Xin quyền mic để lấy stream phục vụ volume analyser
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        startVolumeAnalyser(stream)
        // Đóng stream sau khi analyser đã dùng (Web Speech tự quản lý micro riêng)
        setTimeout(() => stream.getTracks().forEach(t => t.stop()), 500)
      })
      .catch(() => {}) // Volume analyser là tính năng phụ, lỗi cũng được

    // Timeout 30s — SRS FR1.2
    timeoutRef.current = setTimeout(() => {
      recognition.stop()
      if (!transcript) setError('Hết thời gian. Thử nói lại nhé.')
    }, 30000)
  }

  // ─── MODE 2: MediaRecorder + Google STT fallback (iOS Safari) ───────────────
  async function startMediaRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      await startVolumeAnalyser(stream)

      // iOS Safari hỗ trợ audio/mp4, các trình duyệt khác dùng webm/opus
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stopVolumeAnalyser()
        stream.getTracks().forEach(t => t.stop())
        setIsListening(false)
        setIsProcessing(true)

        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType })

          // Kiểm tra audio có đủ dài không (tối thiểu 0.5s)
          if (blob.size < 5000) {
            setError('Ghi âm quá ngắn. Thử nói rõ và lâu hơn nhé.')
            return
          }

          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')
          formData.append('language', 'vi-VN')

          const stored = JSON.parse(localStorage.getItem('cocon-auth') || '{}')
          const token = stored?.state?.token
          const res = await axios.post(
            `${import.meta.env.VITE_API_URL}/chat/stt-fallback`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`,
              },
              timeout: 15000, // 15s timeout
            }
          )

          setTranscript(res.data.transcript)
        } catch (err) {
          const msg = err.response?.data?.error || 'Không nhận dạng được giọng nói. Thử gõ câu hỏi nhé.'
          setError(msg)
        } finally {
          setIsProcessing(false)
        }
      }

      recorder.start()
      setIsListening(true)
      setError(null)
      setTranscript('')

      // Timeout 30s
      timeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, 30000)

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Bạn chưa cho phép dùng micro. Vào Cài đặt → Safari → Micro để bật nhé.')
      } else {
        setError('Không truy cập được micro. Kiểm tra thiết bị nhé.')
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    setError(null)
    if (USE_WEB_SPEECH) startWebSpeech()
    else startMediaRecorder()
  }, [])

  const stopListening = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (recognitionRef.current) recognitionRef.current.stop()
    if (mediaRecRef.current?.state === 'recording') mediaRecRef.current.stop()
    stopVolumeAnalyser()
  }, [])

  function stopAll() {
    stopListening()
    setIsListening(false)
    setIsProcessing(false)
  }

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setInterimText('')
    setError(null)
  }, [])

  return {
    transcript,       // Text đã nhận dạng hoàn chỉnh
    interimText,      // Text tạm khi đang nói (chỉ có ở Web Speech mode)
    isListening,      // Đang thu âm
    isProcessing,     // Đang gọi Google STT (iOS fallback)
    error,            // Thông báo lỗi (null nếu không có)
    volume,           // 0-100 để vẽ sóng âm
    startListening,
    stopListening,
    resetTranscript,
    mode: USE_WEB_SPEECH ? 'webspeech' : 'mediarecorder', // debug info
  }
}