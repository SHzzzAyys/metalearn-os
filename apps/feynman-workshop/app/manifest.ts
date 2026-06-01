import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "费曼坊",
    short_name: "费曼坊",
    description: "用解释和追问暴露理解漏洞。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#047857"
  };
}

