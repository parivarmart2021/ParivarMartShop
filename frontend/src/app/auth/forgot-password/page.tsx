"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Loader2, CheckCircle, ShieldCheck, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/users/forgot-password', { email });
      setStep(2);
      toast.success('OTP sent to your email');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP (Check if 6 digits are entered)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) return toast.error('Please enter 6-digit OTP');
    
    setLoading(true);
    try {
      await api.post('/users/verify-otp', { email, otp: otpString });
      setStep(3);
      toast.success('OTP Verified');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    
    setLoading(true);
    try {
      await api.post('/users/reset-password', { email, otp: otp.join(''), password });
      toast.success('Password updated successfully!');
      setStep(4); // Success state
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-[90vh] flex items-center justify-center p-4 bg-premium">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card max-w-md w-full p-8 sm:p-12 bg-white flex flex-col gap-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-secondary" />
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3 text-center sm:text-left">
                <Link href="/auth/login" className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-primary transition-all w-fit group">
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Login
                </Link>
                <h1 className="text-4xl font-black text-dark tracking-tighter uppercase mt-2">Forgot <span className="text-primary">Password?</span></h1>
                <p className="text-gray-500 font-medium">No worries! Enter your email to receive a secure 6-digit OTP.</p>
              </div>

              <form onSubmit={handleRequestOtp} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input 
                      required
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="input-field pl-12"
                    />
                  </div>
                </div>
                <button disabled={loading} type="submit" className="btn-primary py-5 text-lg flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" /> : 'Send OTP Code'}
                </button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-2">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-3xl font-black text-dark tracking-tighter uppercase">Verify <span className="text-primary">OTP</span></h2>
                <p className="text-gray-500 font-medium px-4">We've sent a 6-digit code to <br/><span className="text-dark font-bold">{email}</span></p>
              </div>

              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-8">
                <div className="flex justify-between gap-2 sm:gap-4">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        if (el) otpInputs.current[index] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      autoFocus={index === 0}
                      className="w-full h-14 sm:h-16 text-center text-2xl font-black rounded-xl border-2 border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white transition-all outline-none text-dark"
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-4">
                  <button disabled={loading} type="submit" className="btn-primary py-5 text-lg">
                    {loading ? <Loader2 className="animate-spin" /> : 'Verify Code'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleRequestOtp} 
                    className="text-primary font-bold hover:underline text-sm"
                  >
                    Didn't receive code? Resend
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-3 text-center sm:text-left">
                <h2 className="text-3xl font-black text-dark tracking-tighter uppercase">Set New <span className="text-primary">Password</span></h2>
                <p className="text-gray-500 font-medium">Great! OTP verified. Now create a strong password for your account.</p>
              </div>

              <form onSubmit={handleResetPassword} className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary">New Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                      <input 
                        required
                        type={showPassword ? 'text' : 'password'} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field pl-12 pr-12"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary">Confirm Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
                      <input 
                        required
                        type={showPassword ? 'text' : 'password'} 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field pl-12"
                      />
                    </div>
                  </div>
                </div>

                <button disabled={loading} type="submit" className="btn-primary py-5 text-lg flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" /> : 'Reset Password'}
                </button>
              </form>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-6 py-8 text-center"
            >
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-500 shadow-inner">
                <CheckCircle size={48} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-3xl font-black text-dark tracking-tighter uppercase">All <span className="text-green-500">Done!</span></h3>
                <p className="text-gray-500 font-medium leading-relaxed px-4">Your password has been successfully reset. You can now log in with your new credentials.</p>
              </div>
              <Link href="/auth/login" className="btn-primary w-full py-5 text-xl">
                Login Now
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
