import type { Metadata } from 'next';
import { Outfit, Inter } from 'next/font/google';
import './globals.css';
import { DockProvider } from '@/context/DockContext';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TruckVision - Sistema Inteligente de Docas & Cronoanálise',
  description: 'Sistema web de visão computacional em tempo real para monitoramento de pátio, cronoanálise de permanência em boxes e gestão logística. Desenvolvido por Mauricio Grigol.',
  authors: [{ name: 'Mauricio Grigol' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${outfit.variable} ${inter.variable} font-sans bg-[#060a13] text-slate-100 min-h-screen antialiased flex flex-col selection:bg-cyan-500 selection:text-slate-950`}>
        <DockProvider>
          {children}
        </DockProvider>
      </body>
    </html>
  );
}
