import { useRef, useCallback, useEffect, useState } from 'react'

interface UseAudioVisualizerReturn {
  audioData: Uint8Array | null
  audioContextRef: React.RefObject<AudioContext | null>
  analyserRef: React.RefObject<AnalyserNode | null>
  connectStream: (stream: MediaStream) => void
  disconnectStream: () => void
}

export function useAudioVisualizer(): UseAudioVisualizerReturn {
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const [audioData, setAudioData] = useState<Uint8Array | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const connectStream = useCallback((stream: MediaStream) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass()
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      sourceRef.current = source

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateData = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          setAudioData(new Uint8Array(dataArray))
        }
        animationFrameRef.current = requestAnimationFrame(updateData)
      }

      updateData()
    } catch (error) {
      console.error('Failed to connect audio stream:', error)
    }
  }, [])

  const disconnectStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (analyserRef.current) {
      analyserRef.current = null
    }

    setAudioData(null)
  }, [])

  useEffect(() => {
    return () => {
      disconnectStream()
    }
  }, [disconnectStream])

  return {
    audioData,
    audioContextRef,
    analyserRef,
    connectStream,
    disconnectStream
  }
}
