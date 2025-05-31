import './globals.css'
import '@mysten/dapp-kit/dist/index.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Job Queue System - SUI Walrus',
  description: 'A Decentralized Job Queue System built on Sui Blockchain'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
