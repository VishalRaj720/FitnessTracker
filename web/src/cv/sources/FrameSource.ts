/**
 * A frame source owns an HTMLVideoElement that the detector reads from.
 * Two implementations: the live camera, and a looping video file (demo/testing).
 */
export interface FrameSource {
  readonly video: HTMLVideoElement
  readonly kind: 'camera' | 'video'
  start(): Promise<void>
  stop(): void
  /** Monotonic timestamp in ms for the current frame. */
  now(): number
}

export class CameraSource implements FrameSource {
  readonly kind = 'camera' as const
  private stream: MediaStream | null = null

  constructor(
    public readonly video: HTMLVideoElement,
    private facingMode: 'user' | 'environment' = 'user',
  ) {}

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported in this browser')
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: this.facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.video.srcObject = this.stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()
    await waitForDimensions(this.video)
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
  }

  now(): number {
    return performance.now()
  }

  async switchFacing(): Promise<void> {
    this.stop()
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user'
    await this.start()
  }

  get facing(): 'user' | 'environment' {
    return this.facingMode
  }
}

/** Plays a bundled/recorded clip through the same pipeline. Used for demo mode and E2E. */
export class VideoFileSource implements FrameSource {
  readonly kind = 'video' as const

  constructor(
    public readonly video: HTMLVideoElement,
    private src: string,
    private loop = true,
  ) {}

  async start(): Promise<void> {
    this.video.src = this.src
    this.video.loop = this.loop
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()
    await waitForDimensions(this.video)
  }

  stop(): void {
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
  }

  now(): number {
    return performance.now()
  }
}

function waitForDimensions(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.videoWidth > 0) return resolve()
    const check = () => {
      if (video.videoWidth > 0) resolve()
      else requestAnimationFrame(check)
    }
    check()
  })
}
