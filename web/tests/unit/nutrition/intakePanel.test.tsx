import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntakePanel } from '@/features/nutrition/components/IntakePanel'
import type { DailyNutrition } from '@/types/api'

// Shaped exactly like GET /api/v1/nutrition/day, so a schema drift on either side breaks this.
const DAY: DailyNutrition = {
  date: '2026-09-26',
  has_profile: true,
  targets: {
    calories: 1740,
    protein_g: 65,
    carbs_g: 248,
    fat_g: 54,
    fiber_g: 24,
    iron_mg: 29,
    calcium_mg: 1000,
    vitamin_c_mg: 65,
    water_ml: 2000,
    bmr: 1266,
    tdee: 1741,
    adjustment_pct: 0,
    protein_pct: 15,
    carbs_pct: 57,
    fat_pct: 28,
    meal_calories: { breakfast: 440, lunch: 610, snack: 170, dinner: 520 },
  },
  consumed: {
    calories: 1850,
    protein_g: 35,
    carbs_g: 163,
    fat_g: 27,
    fiber_g: 21,
    iron_mg: 9.1,
    calcium_mg: 376,
    vitamin_c_mg: 29,
    water_ml: 1000,
  },
  remaining: {
    calories: 0,
    protein_g: 30,
    carbs_g: 85,
    fat_g: 27,
    fiber_g: 3,
    iron_mg: 19.9,
    calcium_mg: 624,
    vitamin_c_mg: 36,
    water_ml: 1000,
  },
  entries: [],
}

function renderPanel(day: DailyNutrition) {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <IntakePanel day={day} dateKey={undefined} dayLabel="Today" />
    </QueryClientProvider>,
  )
}

describe('IntakePanel', () => {
  it('shows consumed against target for calories and every macro', () => {
    renderPanel(DAY)
    expect(screen.getByText('Daily nutrition')).toBeInTheDocument()
    // Once in the ring, once in the 'Eaten' tile.
    expect(screen.getAllByText('1,850')).toHaveLength(2)
    expect(screen.getByText('/ 1,740 kcal')).toBeInTheDocument()
    for (const label of ['Protein', 'Carbohydrates', 'Fat', 'Fibre']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('30 g left')).toBeInTheDocument()
  })

  it('treats a small overshoot as on target but still shows the exact excess', () => {
    renderPanel(DAY) // 1,850 of 1,740 kcal: 6% over, inside the ±8% band
    expect(screen.getByText('ON TARGET')).toBeInTheDocument()
    expect(screen.getByText('110 over')).toBeInTheDocument()
  })

  it('flags a day that clearly went over the calorie target', () => {
    renderPanel({ ...DAY, consumed: { ...DAY.consumed, calories: 1950 } })
    expect(screen.getByText('OVER TARGET')).toBeInTheDocument()
    expect(screen.getByText('210 over')).toBeInTheDocument()
  })

  it('renders hydration and micronutrient meters with accessible values', () => {
    renderPanel(DAY)
    expect(screen.getByText('Hydration')).toBeInTheDocument()
    expect(screen.getByText('4 glasses to go')).toBeInTheDocument()
    const iron = screen.getByRole('progressbar', { name: 'Iron consumed' })
    expect(iron).toHaveAttribute('aria-valuenow', '9')
    expect(iron).toHaveAttribute('aria-valuemax', '29')
  })

  it('renders nothing without targets (no nutrition profile yet)', () => {
    const { container } = renderPanel({ ...DAY, targets: null, remaining: null, has_profile: false })
    expect(container).toBeEmptyDOMElement()
  })
})
