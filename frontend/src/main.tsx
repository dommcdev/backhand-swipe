import '@fontsource-variable/rubik'
import '@fontsource-variable/rubik/wght-italic.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { categories, matchupQueueQuery, rankingsQuery } from './api/queries.ts'
import App from './App.tsx'
import './index.css'
import { RankingsPage } from './pages/RankingsPage.tsx'
import { RankMePage } from './pages/RankMePage.tsx'
import { VotePage } from './pages/VotePage.tsx'

const queryClient = new QueryClient({
  // Data is loaded once up front and refreshed in the background, so screens never show a loading state.
  defaultOptions: { queries: { staleTime: 30_000, gcTime: Infinity } },
})

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <VotePage /> },
      { path: 'rankings', element: <RankingsPage /> },
      { path: 'where-do-i-rank', element: <RankMePage /> },
    ],
  },
])

const fontsReady = Promise.all([
  document.fonts.load('900 1em "Rubik Variable"'),
  document.fonts.load('italic 900 1em "Rubik Variable"'),
])
const atMost = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

await Promise.race([
  Promise.all([
    fontsReady,
    queryClient.prefetchQuery(matchupQueueQuery),
    queryClient.prefetchQuery(rankingsQuery()),
    ...categories.map((c) => queryClient.prefetchQuery(rankingsQuery(c))),
  ]),
  atMost(1500),
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
