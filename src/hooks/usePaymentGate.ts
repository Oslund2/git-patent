import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PaymentStatus {
  isInternal: boolean;
  isPaid: boolean;
  requiresPayment: boolean;
}

const INTERNAL_DOMAINS = (import.meta.env.VITE_INTERNAL_DOMAINS || '')
  .split(',')
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean);

export function usePaymentGate() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);

  /** Quick client-side check — for UX hints only, NOT for enforcement */
  const isInternalUser = useCallback((): boolean => {
    if (!user?.email) return false;
    const domain = user.email.split('@')[1]?.toLowerCase() || '';
    return INTERNAL_DOMAINS.includes(domain);
  }, [user]);

  /** Server-side payment check — authoritative */
  const checkPaymentStatus = useCallback(async (projectId?: string): Promise<PaymentStatus> => {
    if (!user?.email) {
      return { isInternal: false, isPaid: false, requiresPayment: true };
    }

    // Quick client-side shortcut for internal users
    if (isInternalUser()) {
      return { isInternal: true, isPaid: false, requiresPayment: false };
    }

    try {
      setChecking(true);
      const response = await fetch('/.netlify/functions/check-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          projectId,
        }),
      });

      if (!response.ok) {
        console.error('Payment check failed:', response.status);
        return { isInternal: false, isPaid: false, requiresPayment: true };
      }

      return await response.json();
    } catch (err) {
      console.error('Payment check error:', err);
      return { isInternal: false, isPaid: false, requiresPayment: true };
    } finally {
      setChecking(false);
    }
  }, [user, isInternalUser]);

  /** Create a Stripe Checkout session and redirect */
  const initiateCheckout = useCallback(async (
    projectId: string,
    projectName: string
  ): Promise<{ redirected: boolean; error?: string }> => {
    if (!user?.email || !user?.id) {
      return { redirected: false, error: 'You must be signed in to proceed' };
    }

    try {
      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName,
          userEmail: user.email,
          userId: user.id,
        }),
      });

      const data = await response.json();

      // Server confirmed internal user — no payment needed
      if (data.internal) {
        return { redirected: false };
      }

      if (!response.ok) {
        return { redirected: false, error: data.error || 'Checkout creation failed' };
      }

      if (data.url) {
        window.location.href = data.url;
        return { redirected: true };
      }

      return { redirected: false, error: 'No checkout URL returned' };
    } catch (err: any) {
      return { redirected: false, error: err.message || 'Network error' };
    }
  }, [user]);

  return {
    isInternalUser,
    checkPaymentStatus,
    initiateCheckout,
    checking,
  };
}
