import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePhoneVerification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(msg)), ms)
      ),
    ]);
  }

  async function sendOTP(phone: string) {
    setLoading(true);
    setError(null);
    try {
      const { error: otpError } = await withTimeout(
        supabase.auth.updateUser({ phone }),
        10000,
        'Request timed out. Check your connection.'
      );
      if (otpError) throw otpError;
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP(phone: string, token: string) {
    setLoading(true);
    setError(null);
    try {
      const { error: verifyError } = await withTimeout(
        supabase.auth.verifyOtp({ phone, token, type: 'phone_change' }),
        10000,
        'Request timed out. Check your connection.'
      );
      if (verifyError) throw verifyError;
      return true;
    } catch (err: any) {
      setError(err.message ?? 'Invalid OTP');
      return false;
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setCodeSent(false);
    setError(null);
  }

  return { sendOTP, verifyOTP, loading, error, codeSent, reset };
}
