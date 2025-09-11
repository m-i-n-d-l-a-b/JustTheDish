import type { Metadata } from "next"
import localFont from "next/font/local"
import { Inter, Merriweather } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
})

const headingSerif = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-heading",
})

export const metadata: Metadata = {
  title: "Just The Dish",
  description:
    "Skip the ads and pop-ups. Get straight to the recipe with organized ingredients and easy instructions, every time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${geistMono.variable} ${headingSerif.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
