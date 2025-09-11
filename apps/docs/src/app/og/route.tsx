import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const size = { width: 1200, height: 630 } as const;

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const title = searchParams.get('title') ?? 'ConfKit';
  const description =
    searchParams.get('description') ?? 'Type‑safe config. Secure secrets.';

  const logo = new URL('/logo.png', origin).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 64,
          color: '#fff',
          backgroundColor: '#0b0b0b',
          fontFamily: 'Inter, ui-sans-serif, system-ui',
        }}
      >
        {/* Gradient glows */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(900px 500px at 40% -10%, rgba(217,70,239,0.28), transparent 60%), radial-gradient(700px 400px at 110% 70%, rgba(6,182,212,0.22), transparent 60%), radial-gradient(600px 300px at -10% 80%, rgba(139,92,246,0.22), transparent 60%)',
          }}
        />

        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.06,
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '-12px -12px',
          }}
        />

        {/* Framing */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow:
              'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -160px 160px rgba(255,255,255,0.08)',
          }}
        />

        {/* Accent corner */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 280,
            height: 280,
            transform: 'rotate(45deg)',
            background:
              'linear-gradient(135deg, rgba(6,182,212,0.0), rgba(6,182,212,0.3))',
            filter: 'blur(18px)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            maxWidth: 980,
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src={logo}
              width={56}
              height={56}
              alt="ConfKit logo"
              style={{ borderRadius: 8, boxShadow: '0 10px 30px rgba(6,182,212,0.25)' }}
            />
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.2 }}>ConfKit</div>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: -1.2,
            }}
          >
            {title}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 32,
              color: 'rgba(255,255,255,0.82)',
              maxWidth: 980,
            }}
          >
            {description}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
