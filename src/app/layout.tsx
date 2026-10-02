import type { Metadata } from 'next';
import { Outfit, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { TenantProvider } from '@/components/providers/tenant-provider';
import { DockProvider } from '@/context/DockContext';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VisionAi - Sistema Inteligente de Docas & Cronoanálise',
  description: 'Sistema web de visão computacional em tempo real para monitoramento de pátio, cronoanálise de permanência em boxes e gestão logística. Desenvolvido por Mauricio Grigol.',
  authors: [{ name: 'Mauricio Grigol' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col custom-scrollbar selection:bg-cyan-500 selection:text-slate-950">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TenantProvider>
            <DockProvider>
              {children}
            </DockProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
