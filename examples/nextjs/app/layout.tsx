export const metadata = {
  title: 'Confkit Next Example',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 20 }}>
        <header style={{ marginBottom: 20 }}>
          <h1>Confkit × Next.js</h1>
          <nav style={{ display: 'flex', gap: 12 }}>
            <a href="/">Home</a>
            <a href="/env">Client Env</a>
            <a href="/api/config" target="_blank">/api/config</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

