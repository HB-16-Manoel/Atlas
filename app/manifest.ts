import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas",
    short_name: "Atlas",
    description:
      "A personal system for planning, progress, reflection, and intelligence.",
    start_url: "/",
    display: "standalone",
    background_color: "#11131D",
    theme_color: "#11131D",
    orientation: "portrait",
    icons: [
      {
        src: "/atlas-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/atlas-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/atlas-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
