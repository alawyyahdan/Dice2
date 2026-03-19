import './globals.css';

export const metadata = {
  title: 'Dice Game Admin',
  description: 'Admin Dashboard untuk Telegram Dice Game Bot',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
