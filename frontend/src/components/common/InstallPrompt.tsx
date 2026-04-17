"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if the user has already dismissed the prompt
    const isDismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (isDismissed) {
      const dismissedDate = new Date(isDismissed);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Don't show again for 7 days
      if (diffDays < 7) {
        return;
      }
    }

    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-4 right-4 z-[9999] md:left-auto md:right-6 md:w-96"
        >
          <div className="bg-primary text-white p-5 rounded-3xl shadow-2xl flex flex-col gap-4 relative overflow-hidden border border-white/10">
            {/* Abstract background blobs */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-accent/10 rounded-full blur-xl" />
            
            <button 
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-primary shadow-lg p-2 shrink-0">
                <Smartphone size={32} />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-black text-lg tracking-tight leading-tight">Install Parivar Mart</h3>
                <p className="text-white/80 text-xs font-medium leading-tight">Get a faster, better shopping experience with our mobile app.</p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              className="w-full bg-white text-primary py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10"
            >
              <Download size={18} /> Install Now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
