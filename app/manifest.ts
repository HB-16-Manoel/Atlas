import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas",
    short_name: "Atlas",

    description:
      "A personal system for planning, progress, reflection, and intelligence.",

    start_url: "/",

    display: "standalone",

    background_color: "#09090b",

    theme_color: "#09090b",

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
    ],
  };
}