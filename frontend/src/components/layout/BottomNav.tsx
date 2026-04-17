"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, ShoppingCart, User, Search } from 'lucide-react';
import { useCart } from '@/context/CartContext';

const BottomNav = () => {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const navItems = [
    { name: 'Home', path: '/', icon: <Home size={22} /> },
    { name: 'Categories', path: '/products', icon: <Grid size={22} /> },
    { name: 'Search', path: '/search', icon: <Search size={22} /> },
    { name: 'Cart', path: '/cart', icon: <ShoppingCart size={22} />, badge: totalItems },
    { name: 'Account', path: '/profile', icon: <User size={22} /> },
  ];

  // Don't show on admin pages
  if (pathname.startsWith('/admin')) return null;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="bg-dark/90 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] flex items-center justify-around py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.name} 
              href={item.path} 
              className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-white/60 hover:text-white'}`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.name}
              </span>
              
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 right-0 bg-primary text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {item.badge}
                </span>
              )}

              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;
