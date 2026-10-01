import type { MetadataRoute } from "next";

/** Makes the web app installable. Colours are the dark `mist` token, as in the viewport themeColor. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NeuroCal",
    short_name: "NeuroCal",
    description: "Log meals from a photo and see what to eat next for how you want to think and feel.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c1324",
    theme_color: "#0c1324",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
