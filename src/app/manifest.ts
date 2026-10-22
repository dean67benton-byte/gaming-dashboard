import type { MetadataRoute } from "next";

// Lets the dashboard be added to a phone's home screen as an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gaming Dashboard",
    short_name: "Gaming",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d14",
    theme_color: "#0c0d14",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
