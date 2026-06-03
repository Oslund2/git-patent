import { useState } from 'react';
import { Shield, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
}

export function ForgotPasswordPage({ onBackToLogin }: ForgotPasswordPageProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
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
              If an account exists for <strong className="text-gray-900">{email}</strong>, we sent a
              link to reset your password. Open it on this device to choose a new password.
            </p>
            <button
              onClick={onBackToLogin}
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
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-patent-600 to-indigo-600 rounded-2xl shadow-lg shadow-patent-600/20 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Git-Patent</h1>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter your account email and we'll send you a link to set a new password.
          </p>
        </div>

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
            {loading ? 'Sending...' : 'Send reset link'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <button
          onClick={onBackToLogin}
          className="w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-indigo-600 font-medium transition-colors text-sm mt-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
