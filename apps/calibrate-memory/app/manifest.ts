import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "校准记忆",
    short_name: "校准记忆",
    description: "本地优先的提取练习与信心校准工具。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#047857"
  };
}

