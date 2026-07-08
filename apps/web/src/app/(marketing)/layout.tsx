import { Navbar } from '@/components/navbar';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cosmic-gradient">
      <Navbar />
      {children}
    </div>
  );
}
