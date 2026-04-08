import { useState } from 'react';
import { Shield, Mail, Lock, ArrowRight, FileText, Search, BarChart3, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginPageProps {
  onToggleSignUp: () => void;
}

export function LoginPage({ onToggleSignUp }: LoginPageProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  // GitHub OAuth handler — dormant until provider is configured
  // const handleGitHub = async () => {
  //   setError('');
  //   const { error } = await signInWithGitHub();
  //   if (error) setError(error.message);
  // };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left product showcase — 2/3 width */}
      <div className="hidden lg:flex lg:w-2/3 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 items-center justify-center relative overflow-hidden">
        {/* Floating decorative shapes */}
        <div className="absolute top-20 left-16 w-20 h-20 bg-blue-200/40 rounded-2xl rotate-12 animate-pulse" />
        <div className="absolute top-40 right-24 w-14 h-14 bg-violet-200/40 rounded-xl -rotate-6" />
        <div className="absolute bottom-32 left-24 w-16 h-16 bg-indigo-200/40 rounded-full" />
        <div className="absolute bottom-48 right-16 w-10 h-10 bg-amber-200/40 rounded-lg rotate-45" />

        <div className="relative z-10 px-16 max-w-2xl">
          {/* Logo + headline */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-patent-600 to-indigo-600 rounded-2xl shadow-lg shadow-patent-600/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Git-Patent</h1>
          </div>
          <p className="text-lg text-gray-500 leading-relaxed mb-10">
            Turn your source code into USPTO-ready patent applications — AI-powered specification, claims, drawings, and prior art search.
          </p>

          {/* Two-column layout: deliverables + pricing */}
          <div className="grid grid-cols-2 gap-6">
            {/* What you get */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">What you get per project</h3>
              {[
                { icon: FileText, label: 'Full patent specification', detail: 'Claims, abstract, technical drawings, USPTO-format PDF' },
                { icon: Search, label: 'Prior art search & novelty analysis', detail: 'Real patent search, similarity scoring, blocking risk' },
                { icon: BarChart3, label: 'Legal filing brief', detail: 'Readiness score, fee estimate, compliance checklist' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/60 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/80">
                  <div className="w-8 h-8 rounded-lg bg-patent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 text-patent-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="flex flex-col">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Simple pricing</h3>
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/80 p-6 flex-1">
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-bold text-gray-900">$49</span>
                  <span className="text-sm text-gray-500">per project</span>
                </div>
                <p className="text-xs text-gray-500 mb-5">One-time charge. No subscriptions.</p>
                <div className="space-y-2.5">
                  {[
                    'Unlimited patent sections & claims',
                    'Prior art search & novelty analysis',
                    'USPTO-format PDF export',
                    'AI-generated technical drawings',
                    'Secure payment via Stripe',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Internal team members get free, unlimited access.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sign-in panel — 1/3 width */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-patent-600 to-indigo-600 rounded-2xl shadow-lg shadow-patent-600/20 mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Git-Patent</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
            <p className="text-sm text-gray-500 mt-1">to continue to your dashboard</p>
          </div>

          {/* GitHub OAuth button — dormant until provider is configured */}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent focus:bg-white transition-colors text-sm"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <p className="text-red-600 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-patent-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:shadow-lg hover:shadow-patent-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <button onClick={onToggleSignUp} className="text-patent-600 hover:text-indigo-600 font-semibold transition-colors">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
