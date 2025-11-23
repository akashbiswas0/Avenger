import type { Metadata } from 'next'
import './globals.css'
import { CDPProvider } from './cdp-provider'

export const metadata: Metadata = {
  title: 'RentMyHeader - Turn your Twitter header into passive income',
  description: 'Advertisers pay you to display banners on your profile. You control what shows, you set the price.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <CDPProvider>
          {children}
        </CDPProvider>
      </body>
    </html>
  )
}

