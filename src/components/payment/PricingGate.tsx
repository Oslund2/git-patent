import { useState } from 'react';
import { FileText, Search, Sparkles, Shield, CheckCircle, CreditCard, Loader2, PenTool, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePaymentGate } from '../../hooks/usePaymentGate';

interface PricingGateProps {
  onInternalBypass: () => void;
}

const FEATURES = [
  { icon: Sparkles, label: 'AI-powered patent specification' },
  { icon: FileText, label: 'Independent & dependent claims' },
  { icon: PenTool, label: 'Technical drawings (SVG)' },
  { icon: Search, label: 'Prior art search & novelty analysis' },
  { icon: Shield, label: 'USPTO forms (SB-16, ADS, declaration)' },
  { icon: Download, label: 'Export as USPTO-ready PDF' },
];

export function PricingGate({ onInternalBypass }: PricingGateProps) {
  const { user } = useAuth();
  const { isInternalUser } = usePaymentGate();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  // Internal users should never see this page, but handle gracefully
  if (isInternalUser()) {
    onInternalBypass();
    return null;
  }

  const handleCheckout = async () => {
    if (!user?.email || !user?.id) {
      setError('You must be signed in to proceed');
      return;
    }

    setError('');
    setRedirecting(true);

    try {
      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (data.internal) {
        // Server confirmed internal — shouldn't happen but handle it
        onInternalBypass();
        return;
      }

      if (!response.ok) {
        setError(data.error || 'Checkout creation failed');
        setRedirecting(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError('No checkout URL returned');
      setRedirecting(false);
    } catch (err: any) {
      setError(err.message || 'Network error');
      setRedirecting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-patent-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent">
          Generate a Patent Application
        </h2>
        <p className="text-base text-gray-500 mt-3 max-w-lg mx-auto">
          Transform your codebase into a complete, USPTO-ready patent application in minutes
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* What's included */}
        <div className="p-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">What you get</h3>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-patent-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-patent-600" />
                </div>
                <span className="text-sm text-gray-700">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price + CTA */}
        <div className="border-t border-gray-100 bg-gradient-to-br from-gray-50 to-patent-50/30 p-8">
          <div className="flex items-baseline justify-center gap-1.5 mb-2">
            <span className="text-4xl font-bold text-gray-900">$49</span>
            <span className="text-sm text-gray-500">per project</span>
          </div>
          <p className="text-center text-xs text-gray-400 mb-6">One-time charge. No subscription.</p>

          <button
            onClick={handleCheckout}
            disabled={redirecting}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-4 rounded-2xl hover:shadow-lg hover:shadow-violet-600/25 transition-all font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {redirecting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to checkout...</>
            ) : (
              <><CreditCard className="w-5 h-5" /> Get Started</>
            )}
          </button>

          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" /> Secure payment via Stripe
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Instant access after payment
            </span>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { step: '1', title: 'Pay', desc: 'One-time project fee' },
          { step: '2', title: 'Analyze', desc: 'Enter repo URL or upload ZIP' },
          { step: '3', title: 'Download', desc: 'Get USPTO-ready documents' },
        ].map(({ step, title, desc }) => (
          <div key={step} className="text-center">
            <div className="w-8 h-8 rounded-full bg-patent-100 text-patent-600 font-bold text-sm flex items-center justify-center mx-auto mb-2">
              {step}
            </div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
