export default function Loading() {
  return (
    <>
      <style>{`
        @keyframes qiflow-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes qiflow-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        .qiflow-ring {
          animation: qiflow-spin 1.2s linear infinite;
        }
        .qiflow-dot-0 { animation: qiflow-dot 1.2s ease-in-out 0s infinite; }
        .qiflow-dot-1 { animation: qiflow-dot 1.2s ease-in-out 0.2s infinite; }
        .qiflow-dot-2 { animation: qiflow-dot 1.2s ease-in-out 0.4s infinite; }
      `}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0F2C',
        }}
      >
        {/* Glow blobs */}
        <div
          style={{
            position: 'absolute',
            width: 256,
            height: 256,
            borderRadius: '50%',
            background: 'rgba(123,47,190,0.2)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(0,212,255,0.1)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo + ring */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              className="qiflow-ring"
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: 24,
                border: '2.5px solid transparent',
                borderTopColor: '#00D4FF',
                borderRightColor: '#7B2FBE',
              }}
            />
            <img
              src="https://raw.createusercontent.com/4c1916c8-5dfd-43c7-88fb-c7767562deef/"
              alt="QIFlow"
              style={{
                width: 80,
                height: 80,
                borderRadius: 18,
                objectFit: 'cover',
                boxShadow: '0 0 40px rgba(0,212,255,0.3)',
              }}
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: -0.5,
                margin: 0,
                background: 'linear-gradient(90deg, #00D4FF, #7B2FBE)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              QIFlow
            </h1>
            <p style={{ color: '#8B9CC8', fontSize: 13, marginTop: 4 }}>Loading protocol data…</p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {(['qiflow-dot-0', 'qiflow-dot-1', 'qiflow-dot-2'] as const).map((cls) => (
              <div
                key={cls}
                className={cls}
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D4FF' }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
