import type { ReactNode } from 'react';
import Sidebar from '@/components/qiflow/Sidebar';
import Navbar from '@/components/qiflow/Navbar';

export const metadata = {
  title: 'QIFlow — DeFi Lending on QIE Blockchain',
  description: 'Supply assets and borrow against collateral on QIE Blockchain.',
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Sidebar />
      <div className="md:ml-56 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
