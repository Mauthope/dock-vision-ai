'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Tenant, TenantContextType } from '@/lib/tenant/types';

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  isLoading: false,
});

export function TenantProvider({
  children,
  initialTenant = null,
}: {
  children: React.ReactNode;
  initialTenant?: Tenant | null;
}) {
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  return (
    <TenantContext.Provider value={{ tenant, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
