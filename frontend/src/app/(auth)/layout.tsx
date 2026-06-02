import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[460px] xl:w-[520px] flex-col justify-between bg-[#09090b] p-10 relative overflow-hidden shrink-0">
        {/* Decorative gradient orbs */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-16 -right-16 w-72 h-72 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-violet-500/10 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/Leo.png" alt="LEO" width={38} height={38} className="rounded-2xl shadow-lg" />
          <span className="text-white font-bold text-lg tracking-tight">LEO</span>
        </div>

        {/* Tagline block */}
        <div className="relative z-10 space-y-5">
          <h2 className="text-white text-[2rem] font-bold leading-[1.2] tracking-tight">
            Your Brand.<br />One Chat.<br />Every Channel.
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-[22rem]">
            Build your brand&apos;s AI brain. Generate on-brand campaigns, captions, and copy at scale — without losing your voice.
          </p>
          <div className="pt-1 space-y-3">
            {[
              'Brand Core — train LEO on your exact voice',
              'One chat for campaigns, copy & calendars',
              'AI content that actually sounds like you',
            ].map((text) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <span className="text-white/55 text-[13px]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-white/25 text-xs">© 2026 LEO. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-10">
        {children}
      </div>
    </div>
  )
}
