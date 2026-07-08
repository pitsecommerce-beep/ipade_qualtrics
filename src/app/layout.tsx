import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "IPADE Survey Platform",
  description: "Plataforma de encuestas del IPADE Business School",
  icons: {
    icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1B3A5C',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
