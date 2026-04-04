import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePhoneVerification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  async function sendOTP(phone: string) {
    setLoading(true);
    setError(null);
    try {
      // Use updateUser to add phone to existing authenticated user
      // This sends an OTP to the phone number
      const { error: otpError } = await supabase.auth.updateUser({
        phone,
      });
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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'phone_change',
      });
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
