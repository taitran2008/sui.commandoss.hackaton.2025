import './globals.css'
import '@mysten/dapp-kit/dist/index.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Queuing System',
  description: 'A Decentralized Queuing System built on Sui'

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
