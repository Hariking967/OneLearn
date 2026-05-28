import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Sparkles, Brain, Network, BookOpen, Zap, CheckCircle, ArrowRight, Star, GitBranch } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { NeuralBackground } from '@/components/NeuralBackground'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#0a0a12', color: 'hsl(270 15% 92%)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 animate-fade-down"
           style={{ borderBottom: '1px solid hsl(270 15% 12%)', background: 'rgba(10,10,18,0.82)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl"
                 style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.3)' }}>
              <Sparkles className="h-4 w-4 animate-node-pulse" style={{ color: 'hsl(271 91% 70%)' }} />
            </div>
            <span className="text-grad-anim font-bold text-base tracking-tight">OneLearn</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login"
                  className="text-sm font-medium px-4 py-2 rounded-xl transition-all hover:bg-white/5"
                  style={{ color: 'hsl(270 8% 60%)', fontFamily: 'var(--font-display)' }}>
              Sign in
            </Link>
            <Link href="/signup"
                  className="btn-primary text-sm px-5 py-2 rounded-xl inline-flex items-center gap-1.5">
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-28 px-6 text-center overflow-hidden">
        {/* Neural network background */}
        <NeuralBackground />

        {/* Large ambient orbs */}
        <div className="hero-glow-1 absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px] pointer-events-none"
             style={{ background: 'radial-gradient(ellipse, hsl(271 91% 65% / 0.22), transparent 65%)' }} />
        <div className="hero-glow-2 absolute top-60 -left-32 w-72 h-72 rounded-full blur-[80px] pointer-events-none"
             style={{ background: 'hsl(230 91% 65% / 0.15)' }} />
        <div className="hero-glow-3 absolute top-40 -right-20 w-72 h-72 rounded-full blur-[80px] pointer-events-none"
             style={{ background: 'hsl(290 80% 65% / 0.12)' }} />

        <div className="relative max-w-5xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-10 text-xs font-semibold"
               style={{ background: 'hsl(271 91% 65% / 0.1)', border: '1px solid hsl(271 91% 65% / 0.25)', color: 'hsl(271 91% 75%)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-node-pulse" style={{ background: 'hsl(271 91% 65%)' }} />
            AI-powered personalised learning
          </div>

          {/* Headline */}
          <h1 className="animate-fade-up delay-100 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-7">
            Learn smarter.<br />
            <span className="text-grad-anim">Remember forever.</span>
          </h1>

          <p className="animate-fade-up delay-200 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-light"
             style={{ color: 'hsl(270 8% 58%)' }}>
            Drop any topic. OneLearn's AI builds a prerequisite knowledge graph, tutors you in every concept, and tests you until mastery — all in one place.
          </p>

          <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup"
                  className="btn-ring w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold"
                  style={{ background: 'linear-gradient(135deg, hsl(271 91% 65%), hsl(280 80% 58%))', color: '#fff', boxShadow: '0 0 50px hsl(271 91% 65% / 0.45)', fontFamily: 'var(--font-display)' }}>
              Build your knowledge graph
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium glass transition-all hover:border-violet-700/40"
                  style={{ color: 'hsl(270 15% 75%)', fontFamily: 'var(--font-display)' }}>
              Sign in
            </Link>
          </div>

          {/* Trust badges */}
          <div className="animate-fade-up delay-500 flex flex-wrap items-center justify-center gap-6 mt-12"
               style={{ color: 'hsl(270 8% 42%)' }}>
            {['No credit card', 'Free forever tier', 'Setup in 60 seconds'].map((t, i) => (
              <div key={t} className="flex items-center gap-1.5 text-sm">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(142 71% 50%)' }} />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App Preview ─────────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 max-w-5xl mx-auto">
        <Reveal>
          <div className="animate-float rounded-2xl overflow-hidden shadow-2xl"
               style={{ border: '1px solid hsl(270 15% 16%)', background: 'hsl(240 12% 7%)', boxShadow: '0 0 80px hsl(271 91% 65% / 0.1), 0 40px 80px rgba(0,0,0,0.6)' }}>
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: '1px solid hsl(270 15% 11%)', background: 'hsl(240 12% 9%)' }}>
              <div className="flex gap-1.5">
                {['hsl(0 72% 51% / 0.7)', 'hsl(38 92% 50% / 0.7)', 'hsl(142 71% 45% / 0.7)'].map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <div className="flex-1 mx-4 h-6 rounded-lg flex items-center px-3"
                   style={{ background: 'hsl(240 12% 12%)', border: '1px solid hsl(270 15% 14%)' }}>
                <span className="text-xs" style={{ color: 'hsl(270 8% 38%)', fontFamily: 'var(--font-display)' }}>
                  onelearn.app/project/quantum-computing
                </span>
              </div>
            </div>

            {/* App layout mockup */}
            <div className="grid grid-cols-5 gap-0 min-h-72">
              {/* Sidebar mock */}
              <div className="col-span-1 p-4 flex flex-col gap-2" style={{ borderRight: '1px solid hsl(270 15% 11%)', background: 'hsl(240 12% 8%)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-md animate-node-pulse" style={{ background: 'hsl(271 91% 65% / 0.2)', border: '1px solid hsl(271 91% 65% / 0.3)' }} />
                  <div className="h-2.5 rounded-full w-16" style={{ background: 'hsl(271 91% 65% / 0.4)' }} />
                </div>
                {[70, 50, 85, 45].map((w, i) => (
                  <div key={i} className="h-7 rounded-lg" style={{ background: i === 0 ? 'hsl(271 91% 65% / 0.15)' : 'hsl(240 12% 11%)', width: `${w}%` }} />
                ))}
              </div>

              {/* Graph area */}
              <div className="col-span-3 p-5 relative" style={{ background: 'hsl(240 12% 6%)' }}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'hsl(270 8% 35%)', fontFamily: 'var(--font-display)' }}>Knowledge Graph</div>
                <div className="flex flex-col items-center gap-4">
                  <div className="px-4 py-2 rounded-xl text-xs font-bold animate-node-pulse"
                       style={{ background: 'hsl(271 91% 65% / 0.12)', border: '2px solid hsl(271 91% 65% / 0.4)', color: 'hsl(271 91% 75%)', fontFamily: 'var(--font-display)' }}>
                    Quantum Computing
                  </div>
                  <div className="flex gap-10">
                    {[
                      { label: '✓ Qubits', done: true },
                      { label: 'Superposition', done: false },
                      { label: 'Entanglement', done: false },
                    ].map(({ label, done }) => (
                      <div key={label} className="flex flex-col items-center gap-1.5">
                        <div className="w-px h-4" style={{ background: 'hsl(271 91% 65% / 0.25)' }} />
                        <div className="px-3 py-1.5 rounded-lg text-xs font-medium"
                             style={{
                               background: done ? 'hsl(142 71% 45% / 0.1)' : 'hsl(271 91% 65% / 0.07)',
                               border: `1px solid ${done ? 'hsl(142 71% 45% / 0.3)' : 'hsl(271 91% 65% / 0.18)'}`,
                               color: done ? 'hsl(142 71% 58%)' : 'hsl(270 15% 68%)',
                               fontFamily: 'var(--font-display)',
                             }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat area */}
              <div className="col-span-1 p-4 flex flex-col gap-3" style={{ borderLeft: '1px solid hsl(270 15% 11%)', background: 'hsl(240 12% 7%)' }}>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(270 8% 35%)', fontFamily: 'var(--font-display)' }}>Chat</div>
                <div className="flex justify-end">
                  <div className="px-2.5 py-1.5 rounded-xl rounded-br-sm text-xs max-w-full" style={{ background: 'hsl(271 91% 58%)', color: '#fff' }}>
                    What is superposition?
                  </div>
                </div>
                <div className="px-2.5 py-1.5 rounded-xl rounded-bl-sm text-xs" style={{ background: 'hsl(240 12% 12%)', color: 'hsl(270 15% 75%)' }}>
                  A qubit exists in both 0 and 1 states simultaneously until measured...
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 max-w-6xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'hsl(271 91% 65%)' }}>
            Everything you need
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-5">
            A complete learning{' '}
            <span className="text-grad-anim">ecosystem</span>
          </h2>
          <p className="text-lg max-w-xl mx-auto" style={{ color: 'hsl(270 8% 52%)' }}>
            Not just flashcards. An AI that tutors, tests, and remembers — so you build knowledge that lasts.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Network, title: 'Knowledge Graph', desc: 'Your topic becomes a prerequisite DAG. Master fundamentals first, then unlock advanced concepts automatically.', color: '#a78bfa', delay: 0 },
            { icon: Brain, title: 'Smart Quizzes', desc: 'MCQ and descriptive tests generated from your learning. Wrong answers feed a spaced-repetition review deck.', color: '#60a5fa', delay: 100 },
            { icon: BookOpen, title: 'Resource Chat', desc: 'Upload PDFs, YouTube links, or notes. Ask anything — your AI tutor synthesises all sources in context.', color: '#34d399', delay: 200 },
            { icon: Zap, title: 'Spaced Review', desc: 'Flashcards built from your actual mistakes. Reviewed until you genuinely know it — nothing wasted.', color: '#fbbf24', delay: 300 },
            { icon: GitBranch, title: 'Prerequisite Unlock', desc: 'Topics stay locked until you\'re ready. The graph auto-unlocks next steps as you complete milestones.', color: '#f472b6', delay: 400 },
            { icon: Sparkles, title: 'Daily AI Digest', desc: 'Every session opens with a personalised focus card — what to study today, why, and how.', color: '#a3e635', delay: 500 },
          ].map(({ icon: Icon, title, desc, color, delay }) => (
            <Reveal key={title} delay={delay}>
              <div className="feature-card rounded-2xl p-6 h-full group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                     style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="font-bold mb-2.5 text-base" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(270 8% 52%)' }}>{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section className="px-6 pb-28 max-w-4xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'hsl(271 91% 65%)' }}>Process</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">From zero to fluent in{' '}
            <span className="text-grad-anim">3 steps</span>
          </h2>
        </Reveal>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Connector line */}
          <div className="hidden sm:block absolute top-8 left-[22%] right-[22%] h-px"
               style={{ background: 'linear-gradient(90deg, hsl(271 91% 65% / 0.4), hsl(271 91% 65% / 0.1))' }} />

          {[
            { n: '01', title: 'Pick a topic', desc: 'Enter anything — quantum physics, calculus, React. AI decomposes it into a knowledge graph in seconds.', delay: 0 },
            { n: '02', title: 'Learn & explore', desc: 'Chat with the AI tutor, upload resources, take quizzes. Each topic gets its own memory-aware session.', delay: 150 },
            { n: '03', title: 'Track mastery', desc: 'Review wrong answers, earn topic completions, unlock next nodes. Watch your knowledge compound.', delay: 300 },
          ].map(({ n, title, desc, delay }) => (
            <Reveal key={n} delay={delay} className="flex flex-col items-center text-center">
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                   style={{ background: 'hsl(271 91% 65% / 0.1)', border: '1px solid hsl(271 91% 65% / 0.3)' }}>
                <span className="text-xl font-black" style={{ color: 'hsl(271 91% 72%)', fontFamily: 'var(--font-display)' }}>{n}</span>
                <div className="absolute inset-0 rounded-2xl animate-glow-pulse opacity-0 group-hover:opacity-100" />
              </div>
              <h3 className="font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(270 8% 52%)' }}>{desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pb-28">
        <Reveal>
          <div className="max-w-4xl mx-auto rounded-3xl p-10"
               style={{ background: 'hsl(240 12% 9%)', border: '1px solid hsl(270 15% 14%)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              {[
                { value: '10×', label: 'better retention vs passive reading' },
                { value: '∞', label: 'topics you can master' },
                { value: '0s', label: 'setup time — just type a topic' },
                { value: '24 / 7', label: 'AI tutor, always on' },
              ].map(({ value, label }) => (
                <div key={label} className="space-y-1">
                  <p className="text-3xl sm:text-4xl font-black text-grad-anim">{value}</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(270 8% 50%)' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="px-6 pb-32">
        <Reveal>
          <div className="max-w-2xl mx-auto text-center rounded-3xl p-14 relative overflow-hidden"
               style={{ background: 'linear-gradient(135deg, hsl(271 91% 22%), hsl(240 12% 11%))', border: '1px solid hsl(271 91% 65% / 0.2)' }}>
            <div className="absolute inset-0 pointer-events-none"
                 style={{ background: 'radial-gradient(ellipse at 50% -20%, hsl(271 91% 65% / 0.2), transparent 70%)' }} />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-7 animate-glow-pulse"
                   style={{ background: 'hsl(271 91% 65% / 0.15)', border: '1px solid hsl(271 91% 65% / 0.35)' }}>
                <Brain className="h-8 w-8" style={{ color: 'hsl(271 91% 75%)' }} />
              </div>
              <h2 className="text-3xl sm:text-5xl font-black mb-5 leading-tight">
                Your brain deserves{' '}
                <span className="text-grad-anim">better tools.</span>
              </h2>
              <p className="text-lg mb-9 max-w-md mx-auto" style={{ color: 'hsl(270 8% 60%)' }}>
                Stop re-reading the same chapters. Build a structured, tested understanding — and remember it forever.
              </p>
              <Link href="/signup"
                    className="btn-primary inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl text-base"
                    style={{ fontFamily: 'var(--font-display)' }}>
                Start learning free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid hsl(270 15% 11%)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 animate-node-pulse" style={{ color: 'hsl(271 91% 65%)' }} />
            <span className="text-sm font-bold" style={{ color: 'hsl(270 15% 55%)', fontFamily: 'var(--font-display)' }}>OneLearn</span>
          </div>
          <p className="text-xs text-center" style={{ color: 'hsl(270 8% 35%)' }}>
            AI-powered learning platform — turn any topic into mastery
          </p>
          <div className="flex gap-5 text-xs" style={{ color: 'hsl(270 8% 40%)' }}>
            <Link href="/login" className="hover:text-violet-400 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-violet-400 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
