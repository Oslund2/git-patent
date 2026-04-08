import { useState } from 'react';
import { CreditCard, Shield, Loader2, Sparkles, Lock } from 'lucide-react';
import { usePaymentGate } from '../../hooks/usePaymentGate';

interface PaymentGateProps {
  projectId: string;
  projectName: string;
  onInternalUser: () => void;
  onPaid: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PaymentGate({
  projectId,
  projectName,
  onInternalUser,
  onPaid,
  disabled,
  loading: externalLoading,
}: PaymentGateProps) {
  const { isInternalUser, checkPaymentStatus, initiateCheckout, checking } = usePaymentGate();
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const isInternal = isInternalUser();
  const busy = checking || redirecting || externalLoading;

  const handleGenerate = async () => {
    setError('');

    // Internal users go straight through
    if (isInternal) {
      onInternalUser();
      return;
    }

    // Check payment status server-side
    const status = await checkPaymentStatus(projectId);

    if (status.isInternal || status.isPaid) {
      // Already paid or internal
      status.isInternal ? onInternalUser() : onPaid();
      return;
    }

    // Needs payment — redirect to Stripe
    setRedirecting(true);
    const result = await initiateCheckout(projectId, projectName);

    if (!result.redirected) {
      setRedirecting(false);
      if (result.error) {
        setError(result.error);
      } else {
        // Server said internal — no redirect needed
        onInternalUser();
      }
    }
  };

  return (
    <div className="space-y-3">
      {isInternal ? (
        /* Internal user — show free access badge + generate button */
        <div>
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Internal access — no charge</span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={disabled || busy}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-patent-600 to-indigo-600 text-white px-6 py-4 rounded-2xl hover:shadow-lg hover:shadow-patent-600/25 transition-all font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparing...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Generate IP Applications</>
            )}
          </button>
        </div>
      ) : (
        /* External user — show payment button */
        <div>
          <button
            onClick={handleGenerate}
            disabled={disabled || busy}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-4 rounded-2xl hover:shadow-lg hover:shadow-violet-600/25 transition-all font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {redirecting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to payment...</>
            ) : busy ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Checking access...</>
            ) : (
              <><CreditCard className="w-5 h-5" /> Generate IP Applications</>
            )}
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-gray-400">
            <Lock className="w-3 h-3" />
            <span>Secure payment via Stripe — one-time charge per project</span>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
