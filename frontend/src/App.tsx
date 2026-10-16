import { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { NavTabs } from './components/NavTabs'
import { PalettePicker } from './components/PalettePicker'
import { SiteHeader } from './components/SiteHeader'

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col overflow-clip">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-5 px-[18px] pt-6 md:max-w-[1180px] md:px-10 md:pt-9">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="mx-auto flex w-full max-w-[1180px] justify-center px-[18px] pt-12 pb-32 md:justify-end md:px-10 md:pb-10">
        <PalettePicker />
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-20 rounded-t-[22px] bg-slate px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        <NavTabs className="mx-auto max-w-[420px]" />
      </div>
      <ScrollRestoration />
    </div>
  )
}
