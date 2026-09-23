import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RequireAuth, RequireOnboarded } from '@/app/guards'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage, RegisterPage, WelcomePage } from '@/features/auth/pages/AuthPages'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { HomePage } from '@/features/home/HomePage'
import { ExercisesPage } from '@/features/exercises/ExercisesPage'
import { SquadPage } from '@/features/squad/SquadPage'
import { CoachPage } from '@/features/companion/CoachPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { ProfilePage, SettingsPage } from '@/features/profile/ProfilePage'
import { CampusDashboardPage } from '@/features/campus/CampusDashboardPage'
import { TutorialPage } from '@/features/tutorial/TutorialPage'
import { WorkoutPreviewPage } from '@/features/workout/pages/WorkoutPreviewPage'
import { ActiveSessionPage } from '@/features/workout/pages/ActiveSessionPage'
import { SessionSummaryPage } from '@/features/workout/pages/SessionSummaryPage'
import { RecordFixturePage } from '@/features/dev/RecordFixturePage'
import { PipelineDiagnosticsPage } from '@/features/dev/PipelineDiagnosticsPage'
import { DemoGalleryPage } from '@/features/dev/DemoGalleryPage'

export const router = createBrowserRouter([
  { path: '/', element: <WelcomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/campus/:slug', element: <CampusDashboardPage /> },
  { path: '/dev/record', element: <RecordFixturePage /> },
  { path: '/dev/pipeline', element: <PipelineDiagnosticsPage /> },
  { path: '/dev/demos', element: <DemoGalleryPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '/profile/edit', element: <OnboardingPage edit /> },
      {
        element: <RequireOnboarded />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/home', element: <HomePage /> },
              { path: '/exercises', element: <ExercisesPage /> },
              { path: '/squad', element: <SquadPage /> },
              { path: '/coach', element: <CoachPage /> },
              { path: '/progress', element: <ProgressPage /> },
              { path: '/profile', element: <ProfilePage /> },
              { path: '/profile/settings', element: <SettingsPage /> },
            ],
          },
          { path: '/exercises/:slug/tutorial', element: <TutorialPage /> },
          { path: '/workout/preview', element: <WorkoutPreviewPage /> },
          { path: '/workout/live', element: <ActiveSessionPage /> },
          { path: '/workout/summary/:sessionId', element: <SessionSummaryPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
