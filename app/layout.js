import './globals.css'

export const metadata = {
  title: 'Nodens Navigator',
  description: 'Lord of the Great Abyss - Bringing order to the chaos of flight prices',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
