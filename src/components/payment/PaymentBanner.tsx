import { CheckCircle, XCircle } from 'lucide-react';

interface PaymentBannerProps {
  type: 'success' | 'cancelled';
  onDismiss: () => void;
}

export function PaymentBanner({ type, onDismiss }: PaymentBannerProps) {
  if (type === 'success') {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900 text-sm">Payment successful</h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your project is ready. Click Generate to start the IP analysis.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-emerald-400 hover:text-emerald-600 transition-colors"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
          <XCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 text-sm">Payment cancelled</h3>
          <p className="text-xs text-amber-700 mt-0.5">
            No charge was made. You can try again when ready.
          </p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-400 hover:text-amber-600 transition-colors"
      >
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  );
}
