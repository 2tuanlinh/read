import './globals.css';

export const metadata = {
  title: 'tuan2linh',
  description: 'A focused MongoDB reading and message manager'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
