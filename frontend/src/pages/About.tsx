import { Code, Users, Zap, Shield, Globe, Heart, ArrowRight, Github, Twitter, Linkedin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';



const values = [
  {
    icon: Zap,
    title: 'Speed First',
    description: 'Every millisecond matters. We obsess over latency so developers never have to wait.',
    color: 'primary',
  },
  {
    icon: Users,
    title: 'Collaboration Native',
    description: 'Built from day one for teams, not bolted on as an afterthought.',
    color: 'secondary',
  },
  {
    icon: Shield,
    title: 'Security by Default',
    description: 'End-to-end encryption and zero-trust architecture protect every session.',
    color: 'accent-tertiary',
  },
  {
    icon: Globe,
    title: 'Open Ecosystem',
    description: 'Extensible, interoperable, and designed to work with the tools you already use.',
    color: 'primary',
  },
];


const About = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const onGetStarted = () => navigate(user ? '/dashboard' : '/login');

  return (
    <div className="min-h-screen bg-[#060608] overflow-hidden text-foreground font-sans relative">
      {/* Background */}
      <div className="absolute inset-0 bg-circuit opacity-30 pointer-events-none" />
      <div className="absolute inset-0 scanlines pointer-events-none opacity-50" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link to="/" className="flex items-center gap-2 font-mono text-primary font-bold text-xl tracking-tight">
          <span className="text-primary">&gt;_</span>
          <span>CODECOLLABAI.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 font-mono text-sm text-muted-foreground select-none">
          <Link to="/#features" className="hover:text-primary transition-colors">[FEATURES]</Link>
          <Link to="/#workflow" className="hover:text-primary transition-colors">[WORKFLOW]</Link>
          <Link to="/about" className="text-primary">[ABOUT]</Link>
        </nav>

        <div className="flex items-center gap-6 font-mono text-sm">
          <button onClick={onGetStarted} className="hover:text-primary transition-colors text-muted-foreground font-semibold">
            LOG_IN
          </button>
          <button
            onClick={onGetStarted}
            className="border border-primary text-primary px-4 py-1.5 uppercase hover:bg-primary/10 transition-colors shadow-glow"
          >
            INIT_SYSTEM
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 text-primary font-mono text-xs mb-8 shadow-inner-glow uppercase select-none">
          ABOUT // SYSTEM_MANIFEST
        </div>

        <h1 className="text-5xl md:text-7xl font-black font-heading uppercase tracking-tighter leading-[0.9] mb-8">
          <span className="heavy-glitch" data-text="WE BUILD">WE BUILD</span>
          <br />
          <span className="bg-gradient-to-r from-primary via-secondary to-accent-tertiary bg-clip-text text-transparent">
            THE FUTURE
          </span>
          <br />
          <span className="text-accent-tertiary">OF CODING</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-mono leading-relaxed">
          <span className="text-primary">&gt;</span> CodeCollabAI was born from a simple belief: the best software is written together, in real time, without friction.
        </p>
      </section>

      {/* Mission */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="relative rounded-2xl border border-primary/20 bg-[#0a0a0f]/90 p-10 md:p-14 cyber-chamfer overflow-hidden">
          <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-primary/60" />
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-primary/60" />

          <div className="relative z-10">
            <h2 className="text-sm font-mono text-primary uppercase tracking-widest mb-6">// OUR_MISSION</h2>
            <p className="text-2xl md:text-3xl font-bold text-white leading-snug max-w-3xl">
              To eliminate every barrier between an idea and its implementation — making collaborative coding as natural as conversation.
            </p>
            <p className="mt-6 text-muted-foreground text-base leading-relaxed max-w-2xl">
              We're building a platform where distance doesn't matter, where every developer on your team feels like they're sitting right next to each other, and where AI amplifies human creativity rather than replacing it.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20 border-y border-border/50">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold font-heading uppercase mb-4 text-foreground tracking-widest">
            Core Values
          </h2>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            The principles that drive every line of code we write.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl bg-[#1e232d]/80 border border-white/5 p-8 hover:bg-[#232936] transition-colors group"
            >
              <div className={`w-10 h-10 rounded-full bg-${v.color}/10 flex items-center justify-center mb-5 text-${v.color}`}>
                <v.icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-2">{v.title}</h3>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">{v.description}</p>
            </div>
          ))}
        </div>
      </section>



      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="p-12 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border">
          <h2 className="text-3xl font-bold mb-4">Join the movement</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Whether you're a solo hacker or an enterprise team, CodeCollabAI scales with you. Start building — together.
          </p>
          <button
            onClick={onGetStarted}
            className="border border-primary text-primary px-8 py-3 uppercase hover:bg-primary/10 transition-colors flex items-center gap-2 mx-auto shadow-[0_0_15px_rgba(0,255,136,0.2)] font-mono text-sm"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code className="w-4 h-4" />
            <span>CodeCollabAI — Built for elite developers</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;
