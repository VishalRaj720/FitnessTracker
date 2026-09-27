import { useState } from 'react'
import { Card, Chip, PageTitle } from '@/components/ui'
import { DEMO_CLIPS, sampleClipWorld } from '@/cv/demo/clips'
import { projectToPose } from '@/cv/demo/project'
import { DemoFigure } from '@/features/tutorial/DemoFigure'
import { EXERCISE_DEFINITIONS } from '@/cv/exercises'

/**
 * Developer tool (/dev/demos): every tutorial demo side by side, with the numbers the
 * analyzer reads off each pose.
 *
 * This is where the demo angles get tuned. `demoClips.test.ts` asserts the same numbers
 * land inside each exercise's thresholds; this page is for checking the figure also
 * *looks* like the movement, which no test can tell you. Not linked from the app UI.
 */
export function DemoGalleryPage() {
  const [frozen, setFrozen] = useState<number | null>(null)
  const slugs = Object.keys(DEMO_CLIPS)

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <PageTitle title="Demo gallery" subtitle="dev tool · the tutorial figure for every exercise" />

      <div className="flex flex-wrap gap-2">
        <Chip active={frozen === null} onClick={() => setFrozen(null)}>
          Play
        </Chip>
        <Chip active={frozen === 0} onClick={() => setFrozen(0)}>
          Start
        </Chip>
        <Chip active={frozen === 0.45} onClick={() => setFrozen(0.45)}>
          Deepest
        </Chip>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slugs.map((slug) => {
          const clip = DEMO_CLIPS[slug]
          const def = EXERCISE_DEFINITIONS[slug]
          const u = frozen ?? clip.holdAt
          const features = def.features(projectToPose(sampleClipWorld(clip, u), clip.view))
          return (
            <Card key={slug} pad="sm" radius="xl">
              <div className="mb-1 flex items-center justify-between">
                <div className="font-semibold">{def.name}</div>
                <span className="text-[11px] text-slate-500">{clip.view}</span>
              </div>
              <div className="aspect-square w-full overflow-hidden rounded-xl border border-line bg-ink-950">
                <DemoFigure clip={clip} frozenAt={frozen ?? undefined} />
              </div>
              <div className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-400">
                <div className="text-slate-500">at u={u.toFixed(2)}</div>
                {Object.entries(features).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="text-slate-200">{v.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
