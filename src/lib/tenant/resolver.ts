export function getTenantFromHostname(hostname: string): string | null {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const cleanedHost = hostname.replace(`:${process.env.PORT || 3000}`, '');

  // Localhost direto ou o proprio dominio raiz, nao ha tenant especifico
  if (cleanedHost === rootDomain.split(':')[0] || cleanedHost === 'localhost') {
    return null;
  }

  // Extrai o primeiro segmento caso seja subdominio (ex: tenant.meudominio.com)
  if (cleanedHost.endsWith(`.${rootDomain.split(':')[0]}`)) {
    return cleanedHost.replace(`.${rootDomain.split(':')[0]}`, '');
  }

  return null;
}
