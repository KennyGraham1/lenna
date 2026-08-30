import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hydration Garden",
    short_name: "Garden",
    description: "Sip by sip, grow your garden.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3faf3",
    theme_color: "#7cc47c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Log water", short_name: "Log", url: "/log" },
      { name: "My garden", short_name: "Garden", url: "/garden" }
    ]
  };
}
