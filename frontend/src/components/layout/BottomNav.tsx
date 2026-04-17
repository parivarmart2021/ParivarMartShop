"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, ShoppingCart, User, Package } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { motion } from 'framer-motion';

const BottomNav = () => {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const navItems = [
    { name: 'Home', path: '/', icon: <Home size={22} /> },
    { name: 'Items', path: '/products', icon: <Grid size={22} /> },
    { name: 'Orders', path: '/profile?tab=orders', icon: <Package size={22} /> },
    { name: 'Cart', path: '/cart', icon: <ShoppingCart size={22} />, badge: totalItems },
    { name: 'Profile', path: '/profile', icon: <User size={22} /> },
  ];

  // Don't show on admin pages
  if (pathname.startsWith('/admin')) return null;

  return (
    <div className="lg:hidden fixed bottom-6 left-0 right-0 z-50 px-6">
      <div className="bg-white/95 backdrop-blur-md border border-gray-100 rounded-[35px] shadow-[0_15px_50px_rgba(0,0,0,0.15)] flex items-center justify-around py-3 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.name} 
              href={item.path} 
              className={`relative flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 ${isActive ? 'text-cyan-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <div className={`p-3 rounded-full transition-all duration-500 ${isActive ? 'bg-cyan-50 scale-110 shadow-sm' : ''}`}>
                {React.cloneElement(item.icon as React.ReactElement, { 
                  size: 24,
                  strokeWidth: isActive ? 2.5 : 2
                })}
              </div>
              
              <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-60'}`}>
                {item.name}
              </span>
              
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {item.badge}
                </span>
              )}

              {isActive && (
                <motion.div 
                  layoutId="activeDot"
                  className="absolute -bottom-1 w-1.5 h-1.5 bg-cyan-600 rounded-full" 
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
