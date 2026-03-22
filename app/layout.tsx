import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Србијапут · Аналитика горива флоте',
  description: 'Dashboard za praćenje potrošnje goriva i troškova flote vozila',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body style={{ margin: 0, padding: 0, background: '#07080d' }}>
        {children}
      </body>
    </html>
  )
}
