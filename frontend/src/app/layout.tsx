import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ReliefOS Command Center",
  description: "Disaster resource orchestration system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
        <div className="w-full bg-yellow-500 text-black text-center font-bold py-1 uppercase tracking-widest text-sm z-50">
          Simulation Mode
        </div>
        <nav className="flex items-center gap-6 p-4 bg-slate-800 border-b border-slate-700">
          <div className="font-bold text-xl text-blue-400 mr-4">ReliefOS</div>
          <Link href="/" className="hover:text-blue-300 transition-colors">Overview</Link>
          <Link href="/map" className="hover:text-blue-300 transition-colors">Situation Map</Link>
          <Link href="/predictions" className="hover:text-blue-300 transition-colors">Predictions</Link>
          <Link href="/strategy-lab" className="hover:text-blue-300 transition-colors">Strategy Lab</Link>
          <Link href="/allocations" className="hover:text-blue-300 transition-colors">Active Allocations</Link>
          <Link href="/simulation" className="hover:text-blue-300 transition-colors">Simulation</Link>
          <Link href="/audit" className="hover:text-blue-300 transition-colors">Audit</Link>
        </nav>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
