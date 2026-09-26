import { describe, expect, it } from 'vitest'
import { fmtInt, fmtIsoDay, fmtNum, fmtServings, shiftIsoDate } from '@/lib/format'
import { mealForNow } from '@/features/nutrition/meals'
import { areaPath, smoothPath, toPoints } from '@/lib/svgPath'
import { firstName, initials } from '@/lib/people'

describe('serving formatting', () => {
  it('writes halves and quarters the way people say them', () => {
    expect(fmtServings(1)).toBe('1')
    expect(fmtServings(1.5)).toBe('1½')
    expect(fmtServings(0.5)).toBe('½')
    expect(fmtServings(2.25)).toBe('2¼')
    expect(fmtServings(0.75)).toBe('¾')
  })

  it('keeps numbers readable', () => {
    expect(fmtInt(1740.4)).toBe('1,740')
    expect(fmtInt(null)).toBe('—')
    expect(fmtNum(7)).toBe('7')
    expect(fmtNum(7.25)).toBe('7.3')
  })
})

describe('calendar-day arithmetic', () => {
  it('moves across month and year boundaries without timezone drift', () => {
    expect(shiftIsoDate('2026-09-26', -1)).toBe('2026-09-25')
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('labels the day itself, not a shifted one', () => {
    expect(fmtIsoDay('2026-09-26', { day: 'numeric', month: 'short' })).toMatch(/26/)
  })
})

describe('meal of the day', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m)
  it('maps the clock to the meal most people are eating', () => {
    expect(mealForNow(at(7))).toBe('breakfast')
    expect(mealForNow(at(10, 29))).toBe('breakfast')
    expect(mealForNow(at(13))).toBe('lunch')
    expect(mealForNow(at(17))).toBe('snack')
    expect(mealForNow(at(21))).toBe('dinner')
  })
})

describe('telemetry curve geometry', () => {
  it('maps values into the box with y growing downward', () => {
    const pts = toPoints([0, 50, 100], 100, 100, { pad: 0, min: 0, max: 100 })
    expect(pts).toEqual([
      [0, 100],
      [50, 50],
      [100, 0],
    ])
  })

  it('emits one cubic segment per gap and closes the area to the floor', () => {
    const pts = toPoints([1, 2, 3], 90, 60)
    const d = smoothPath(pts)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.match(/ C /g)).toHaveLength(2)
    expect(areaPath(pts, 60).endsWith('Z')).toBe(true)
    expect(smoothPath([])).toBe('')
  })
})

describe('people helpers', () => {
  it('derives initials and first names defensively', () => {
    expect(initials('Asha Rao')).toBe('AR')
    expect(initials('asha')).toBe('AS')
    expect(initials('')).toBe('FS')
    expect(firstName('  Asha  Rao ')).toBe('Asha')
    expect(firstName(undefined)).toBe('there')
  })
})
