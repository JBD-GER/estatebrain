import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Estate Brain",
    short_name: "Estate Brain",
    description:
      "Cashflow- und Portfolioverwaltung für private Immobilieninvestoren.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7faf8",
    theme_color: "#237a63",
    lang: "de-DE",
  };
}
