import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const crimson = Crimson_Pro({ subsets: ['latin'], variable: '--font-crimson' });

export const metadata: Metadata = {
  title: 'Novelist Studio - Viết tiểu thuyết chuyên nghiệp',
  description: 'Web app viết tiểu thuyết chuyên nghiệp, tích hợp AI, chạy 24/7 miễn phí trên Cloudflare',
  keywords: ['viết tiểu thuyết', 'novel writing', 'AI writing', 'scrivener', 'notion for writers'],
  authors: [{ name: 'Novelist Studio' }],
  openGraph: {
    title: 'Novelist Studio',
    description: 'Công cụ viết tiểu thuyết chuyên nghiệp cho nhà văn Việt Nam',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} ${crimson.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
