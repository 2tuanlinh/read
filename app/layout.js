import './globals.css';

export const metadata = {
  title: 'Private Chat Manager',
  description: 'A focused MongoDB message manager'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
