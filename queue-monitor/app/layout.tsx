import './globals.css'
import '@mysten/dapp-kit/dist/index.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Hello World - Walrus Site',
  description: 'A Hello World Next.js static site deployed on SUI Walrus',
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
