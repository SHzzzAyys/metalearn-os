import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "学习罗盘",
    short_name: "学习罗盘",
    description: "计划、监控、反思与元认知校准。",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#047857"
  };
}

