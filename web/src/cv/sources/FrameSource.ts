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

/** Requested capture geometry. The governor changes this as the device proves itself. */
export interface CaptureProfile {
  width: number
  height: number
  frameRate: number
}

export const DEFAULT_CAPTURE: CaptureProfile = { width: 640, height: 480, frameRate: 30 }

export class CameraSource implements FrameSource {
  readonly kind = 'camera' as const
  private stream: MediaStream | null = null
  private profile: CaptureProfile

  constructor(
    public readonly video: HTMLVideoElement,
    private facingMode: 'user' | 'environment' = 'user',
    profile: CaptureProfile = DEFAULT_CAPTURE,
  ) {
    this.profile = profile
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported in this browser')
    const constraints: MediaStreamConstraints = { audio: false, video: this.videoConstraints() }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.video.srcObject = this.stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()
    await waitForDimensions(this.video)
  }

  private videoConstraints(): MediaTrackConstraints {
    return {
      facingMode: this.facingMode,
      width: { ideal: this.profile.width },
      height: { ideal: this.profile.height },
      // `ideal` rather than `max` so a 60 fps capable camera is actually allowed to reach it.
      frameRate: { ideal: this.profile.frameRate },
    }
  }

  /**
   * Retune the live track in place. Restarting the stream would drop the user out of the
   * framing stage, so a tier change must never do that.
   */
  async applyProfile(profile: CaptureProfile): Promise<void> {
    this.profile = profile
    const track = this.stream?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints(this.videoConstraints())
    } catch {
      // Some devices refuse mid-stream constraint changes; the inference-side downscale
      // and frame-rate throttle still apply, so this is not fatal.
    }
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
