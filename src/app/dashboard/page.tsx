'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { KPISummary } from '@/components/KPISummary';
import { DashboardCharts } from '@/components/DashboardCharts';
import { IPCameraModal } from '@/components/IPCameraModal';
import { RemoteDeviceModal } from '@/components/RemoteDeviceModal';

export default function DashboardPage() {
  const [isIPModalOpen, setIsIPModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  return (
    <>
      <Navbar
        onOpenIPModal={() => setIsIPModalOpen(true)}
        onOpenDeviceModal={() => setIsDeviceModalOpen(true)}
      />

      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 flex flex-col gap-6 pb-20">
        
        {/* Painel de Indicadores */}
        <KPISummary />

        {/* Gráficos e Análise Estatística */}
        <DashboardCharts />

      </main>

      <IPCameraModal
        isOpen={isIPModalOpen}
        onClose={() => setIsIPModalOpen(false)}
      />

      <RemoteDeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />
    </>
  );
}
