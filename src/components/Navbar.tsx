'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Truck,
  LayoutDashboard,
  History,
  Smartphone,
  Video,
  Volume2,
  VolumeX,
  Menu,
  X,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import { useDock } from '../context/DockContext';
import { ThemeToggle } from './theme-toggle';

interface NavbarProps {
  onOpenIPModal?: () => void;
  onOpenDeviceModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenIPModal, onOpenDeviceModal }) => {
  const pathname = usePathname();
  const { boxes, settings, updateSettings, cameras, activeCameraId } = useDock();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const occupiedCount = boxes.filter(b => b.status === 'occupied').length;
  const currentCam = cameras.find(c => c.id === activeCameraId) || cameras[0];

  const navLinks = [
    {
      label: 'Monitor de Docas',
      shortLabel: 'Docas',
      href: '/',
      icon: <Truck className="w-4 h-4" />
    },
    {
      label: 'Dashboard & Métricas',
      shortLabel: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />
    },
    {
      label: 'Histórico & Logs',
      shortLabel: 'Histórico',
      href: '/history',
      icon: <History className="w-4 h-4" />
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-black/30 transition-colors">
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* Logo & Marca (Estilo Bahia) */}
          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-emerald-500 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 group-hover:text-emerald-300 transition-colors" />
                </div>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-lg sm:text-xl text-slate-900 dark:text-white">
                    Vision<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 dark:from-cyan-400 dark:via-teal-300 dark:to-emerald-400">Ai</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/60 uppercase">
                    Dock
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hidden lg:inline leading-none font-medium">
                  Cronoanálise por Visão Computacional
                </span>
              </div>
            </Link>

            {/* Badge de Autor (Inspirado no projeto Bahia) */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400">Criado por</span>
              <strong className="text-cyan-700 dark:text-cyan-300 font-semibold tracking-wide">Mauricio Grigol</strong>
            </div>
          </div>

          {/* Navegação Desktop & Tablet */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            {navLinks.map(item => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 dark:bg-gradient-to-r dark:from-cyan-500/20 dark:to-teal-500/10 text-cyan-800 dark:text-cyan-300 border border-cyan-400/40 dark:border-cyan-500/30 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {item.icon}
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="inline lg:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>

          {/* Badges de Status & Controles Rápidos */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* Ocupação das Docas */}
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${occupiedCount > 0 ? 'bg-amber-500 dark:bg-amber-400 animate-ping' : 'bg-emerald-500 dark:bg-emerald-400'}`} />
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">Docas:</span>
              <span className="text-slate-900 dark:text-white font-bold">{occupiedCount}/{boxes.length}</span>
              <span className="text-[10px] text-slate-500 hidden xl:inline">ocupadas</span>
            </div>

            {/* Alternador de Áudio */}
            <button
              onClick={() => updateSettings({ soundAlerts: !settings.soundAlerts })}
              title={settings.soundAlerts ? 'Silenciar avisos sonoros' : 'Ativar avisos sonoros'}
              className={`p-2 rounded-xl border transition-colors ${
                settings.soundAlerts
                  ? 'bg-cyan-100 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-200 dark:hover:bg-cyan-900/50'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              {settings.soundAlerts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Alternador de Tema Claro / Escuro */}
            <ThemeToggle />

            {/* Botão Câmera IP / Fontes */}
            {onOpenIPModal && (
              <button
                onClick={onOpenIPModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 text-slate-700 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 text-xs font-medium transition-all"
                title="Configurar Câmeras IP e Fontes de Vídeo"
              >
                <Video className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="hidden xl:inline">{currentCam?.name ? currentCam.name.slice(0, 16) + '...' : 'Câmeras'}</span>
              </button>
            )}

            {/* Conectar Aparelho Remoto */}
            {onOpenDeviceModal && (
              <button
                onClick={onOpenDeviceModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-cyan-950/20 dark:shadow-cyan-950/50 transition-all active:scale-95"
                title="Conectar smartphone como câmera ou terminal de boxe"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden lg:inline">Conectar Aparelho</span>
                <span className="hidden sm:inline lg:hidden">Aparelho</span>
              </button>
            )}

            {/* Menu Mobile Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Menu Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 px-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl rounded-b-2xl shadow-xl">
            {navLinks.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  pathname === item.href
                    ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-3">
              <span>Criado por Mauricio Grigol</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-mono">v1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
