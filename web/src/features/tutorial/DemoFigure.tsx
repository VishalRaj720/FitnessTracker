import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { StickFigure3D } from '@/cv/render/StickFigure3D'
import { sampleClipWorld, type DemoClip } from '@/cv/demo/clips'

/**
 * The rotatable demo figure. Drag to orbit; it drifts on its own when left alone so the
 * three-dimensionality is obvious without the user having to discover the gesture.
 */
export function DemoFigure({ clip, className, frozenAt }: { clip: DemoClip; className?: string; frozenAt?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frozenRef = useRef(frozenAt)
  frozenRef.current = frozenAt

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fig = new StickFigure3D(canvas, {
      // Start square-on to the camera angle the exercise is coached from.
      yaw: clip.view === 'side' ? 75 : 0,
      pitch: 6,
      sampler: (tMs) => sampleClipWorld(clip, frozenRef.current ?? (tMs % clip.loopMs) / clip.loopMs),
    })
    fig.start()
    return () => fig.dispose()
  }, [clip])

  return <canvas ref={canvasRef} className={clsx('h-full w-full cursor-grab active:cursor-grabbing', className)} />
}
