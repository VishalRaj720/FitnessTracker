import { get, set } from 'idb-keyval'

const KEY = 'fitsathi:tutorials-completed'

/**
 * Which tutorials this device has finished.
 *
 * Deliberately device-local rather than on the profile: the only server-side write available
 * is a whole-profile PUT, and firing that from the tutorial risks clobbering goal/level with
 * whatever the client happened to be holding. "Have I been shown this yet" is per-device UI
 * state anyway, so IndexedDB is the honest home for it.
 */
export async function getCompletedTutorials(): Promise<string[]> {
  try {
    return (await get<string[]>(KEY)) ?? []
  } catch {
    return []
  }
}

export async function markTutorialCompleted(slug: string): Promise<string[]> {
  try {
    const done = await getCompletedTutorials()
    if (done.includes(slug)) return done
    const next = [...done, slug]
    await set(KEY, next)
    return next
  } catch {
    return [slug]
  }
}
