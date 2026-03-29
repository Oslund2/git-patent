import { useState } from 'react';
import { Shield, GitFork, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface LoginPageProps {
  onToggleSignUp: () => void;
}

export function LoginPage({ onToggleSignUp }: LoginPageProps) {
  const { signIn, signInWithGitHub } = useAuth();
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
    <div className="min-h-screen bg-gradient-to-br from-shield-950 via-shield-900 to-shield-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-shield-600 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">IP Shield</h1>
          <p className="text-shield-300 mt-2">Protect your intellectual property with AI</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <button
            onClick={handleGitHub}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors mb-6"
          >
            <GitFork className="w-5 h-5" />
            Continue with GitHub
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-shield-300">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-shield-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-shield-400 focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-shield-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-shield-400 focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-shield-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-shield-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <p className="text-center text-shield-300 text-sm mt-6">
            Don't have an account?{' '}
            <button onClick={onToggleSignUp} className="text-shield-400 hover:text-white font-medium">
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
