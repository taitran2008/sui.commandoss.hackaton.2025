import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
