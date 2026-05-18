export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: '#0d0d14' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full"
           style={{ background: 'radial-gradient(circle, hsl(271 91% 65% / 0.14) 0%, transparent 65%)' }} />
      <div className="pointer-events-none absolute -bottom-48 -right-48 h-[600px] w-[600px] rounded-full"
           style={{ background: 'radial-gradient(circle, hsl(271 91% 65% / 0.1) 0%, transparent 65%)' }} />
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0"
           style={{ backgroundImage: 'radial-gradient(hsl(271 91% 65% / 0.12) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="w-full max-w-[420px] px-4 relative z-10">
        {children}
      </div>
    </div>
  )
}
