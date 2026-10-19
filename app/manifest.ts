import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DOPATAN - スワイプでTOEIC英単語",
    short_name: "DOPATAN",
    description: "派手な演出で覚えるTOEIC英単語アプリ",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#7b2ff7",
    theme_color: "#7b2ff7",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
