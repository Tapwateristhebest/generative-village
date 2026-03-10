import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Generative Village',
  description: 'A Stardew Valley-inspired farming simulator with AI villagers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#1a1a2e',
        color: '#e0e0e0',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {children}
      </body>
    </html>
  );
}
