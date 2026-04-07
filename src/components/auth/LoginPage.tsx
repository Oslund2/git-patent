import { useState } from 'react';
import { Shield, GitFork, Mail, Lock, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginPageProps {
  onToggleSignUp: () => void;
}

export function LoginPage({ onToggleSignUp }: LoginPageProps) {
  const { signIn, signInWithGitHub, signInAsGuest } = useAuth();
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

  const handleGitHub = async () => {
    setError('');
    const { error } = await signInWithGitHub();
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left hero panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 items-center justify-center relative overflow-hidden">
        {/* Floating decorative shapes */}
        <div className="absolute top-20 left-16 w-20 h-20 bg-blue-200/40 rounded-2xl rotate-12 animate-pulse" />
        <div className="absolute top-40 right-24 w-14 h-14 bg-violet-200/40 rounded-xl -rotate-6" />
        <div className="absolute bottom-32 left-24 w-16 h-16 bg-indigo-200/40 rounded-full" />
        <div className="absolute bottom-48 right-16 w-10 h-10 bg-amber-200/40 rounded-lg rotate-45" />
        <div className="absolute top-1/3 left-1/3 w-24 h-24 bg-patent-200/30 rounded-3xl -rotate-12" />

        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-patent-600 to-indigo-600 rounded-3xl shadow-lg shadow-patent-600/20 mb-8">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Git-Patent</h1>
          <p className="text-lg text-gray-500 leading-relaxed">
            Protect your intellectual property with AI-powered analysis. Discover patents, copyrights, and trademarks hidden in your codebase.
          </p>
          <div className="mt-10 flex items-center justify-center gap-6 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Patent Discovery
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              Copyright Analysis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Trademark Detection
            </span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-patent-600 to-indigo-600 rounded-2xl shadow-lg shadow-patent-600/20 mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Git-Patent</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-base text-gray-500 mt-2">Sign in to continue to your dashboard</p>
          </div>

          <button
            onClick={() => signInAsGuest()}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-patent-600 to-indigo-600 text-white font-semibold py-4 px-4 rounded-xl hover:shadow-lg hover:shadow-patent-600/25 transition-all mb-4 text-lg"
          >
            <Zap className="w-5 h-5" />
            Get Started — No Account Needed
          </button>

          <button
            onClick={handleGitHub}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-800 transition-all hover:shadow-md mb-6"
          >
            <GitFork className="w-5 h-5" />
            Continue with GitHub
          </button>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-sm text-gray-400">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent focus:bg-white transition-colors text-base"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent focus:bg-white transition-colors text-base"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-patent-600 to-indigo-600 text-white font-semibold py-3.5 px-4 rounded-xl hover:shadow-lg hover:shadow-patent-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-gray-500 text-base mt-8">
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
