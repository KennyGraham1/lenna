import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { CameraProvider } from "@/components/CameraProvider";
import { GardenProvider } from "@/components/GardenProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hydration Garden",
  description: "Sip by sip, grow your garden — hydration tracking with a plant collection.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='80' font-size='80'>🌱</text></svg>"
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
