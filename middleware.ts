import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromHostname } from '@/lib/tenant/resolver';

export const config = {
  matcher: [
    '/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const tenant = getTenantFromHostname(hostname);

  const requestHeaders = new Headers(req.headers);
  if (tenant) {
    requestHeaders.set('x-tenant', tenant);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
