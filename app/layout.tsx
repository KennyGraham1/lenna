import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { CameraProvider } from "@/components/CameraProvider";
import { GardenProvider } from "@/components/GardenProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { ToastProvider } from "@/components/ToastProvider";
import { TopBar } from "@/components/TopBar";
import "react-day-picker/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hydration Garden",
  description: "Sip by sip, grow your garden — hydration tracking with a plant collection.",
  applicationName: "Hydration Garden",
  appleWebApp: { capable: true, title: "Garden", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7cc47c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorker />
        <ToastProvider>
          <CameraProvider>
            <GardenProvider>
              <div className="app">
                <TopBar />
                <main className="content">{children}</main>
                <BottomNav />
              </div>
            </GardenProvider>
          </CameraProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
