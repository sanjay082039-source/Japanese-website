import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RIT Japanese Course | 現代日本語アカデミー • Modern Japanese Digital Academy",
  description:
    "RIT Japanese Course combining modern digital pedagogy, authentic brush typography, hour-by-hour timetables, interactive 3D flashcards, and certification across JLPT N5 to N1.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Shippori+Mincho:wght@500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#081220] text-slate-100 font-sans antialiased selection:bg-[#f06449] selection:text-white">
        {children}
      </body>
    </html>
  );
}
