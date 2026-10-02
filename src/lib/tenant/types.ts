export interface Tenant {
  id: string;
  slug: string;
  name: string;
  customDomain?: string;
  primaryColor?: string;
  createdAt: Date;
}

export interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
}
