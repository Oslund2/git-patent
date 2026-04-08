import { useState } from 'react';
import { Shield, GitFork, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SignUpPageProps {
  onToggleLogin: () => void;
}

export function SignUpPage({ onToggleLogin }: SignUpPageProps) {
  const { signUp, signInWithGitHub } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  const handleGitHub = async () => {
    setError('');
    const { error } = await signInWithGitHub();
    if (error) setError(error.message);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl shadow-lg shadow-green-500/20 mb-6">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h2>
            <p className="text-base text-gray-500 mb-8">
              We sent a confirmation link to <strong className="text-gray-900">{email}</strong>
            </p>
            <button
              onClick={onToggleLogin}
              className="text-patent-600 hover:text-indigo-600 font-semibold transition-colors text-base"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left form panel */}
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
            <h2 className="text-3xl font-bold text-gray-900">Create your account</h2>
            <p className="text-base text-gray-500 mt-2">Start protecting your intellectual property today</p>
          </div>

          <button
            onClick={handleGitHub}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white font-semibold py-3.5 px-4 rounded-xl hover:bg-gray-800 transition-all hover:shadow-md mb-8"
          >
            <GitFork className="w-5 h-5" />
            Sign up with GitHub
          </button>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-sm text-gray-400">or sign up with email</span>
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
                  placeholder="At least 6 characters"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-patent-500 focus:border-transparent focus:bg-white transition-colors text-base"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
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
              {loading ? 'Creating account...' : 'Create Account'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-gray-500 text-base mt-8">
            Already have an account?{' '}
            <button onClick={onToggleLogin} className="text-patent-600 hover:text-indigo-600 font-semibold transition-colors">
              Sign in
            </button>
          </p>
        </div>
      </div>

      {/* Right hero panel (mirrored) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-bl from-blue-50 via-indigo-50 to-violet-50 items-center justify-center relative overflow-hidden">
        {/* Floating decorative shapes */}
        <div className="absolute top-24 right-16 w-20 h-20 bg-blue-200/40 rounded-2xl -rotate-12 animate-pulse" />
        <div className="absolute top-44 left-24 w-14 h-14 bg-violet-200/40 rounded-xl rotate-6" />
        <div className="absolute bottom-36 right-24 w-16 h-16 bg-indigo-200/40 rounded-full" />
        <div className="absolute bottom-52 left-16 w-10 h-10 bg-amber-200/40 rounded-lg -rotate-45" />
        <div className="absolute top-1/3 right-1/3 w-24 h-24 bg-patent-200/30 rounded-3xl rotate-12" />

        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-patent-600 to-indigo-600 rounded-3xl shadow-lg shadow-patent-600/20 mb-8">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Git-Patent</h1>
          <p className="text-lg text-gray-500 leading-relaxed">
            Join thousands of developers protecting their innovations. AI-powered IP analysis at your fingertips.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 text-left max-w-xs mx-auto">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </span>
              Automatic patent discovery
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              </span>
              Prior art search & novelty analysis
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </span>
              USPTO-format PDF export
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
