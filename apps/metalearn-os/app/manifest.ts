import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MetaLearn OS",
    short_name: "MetaLearn",
    description: "本地优先的学习掌握系统。",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#047857"
  };
}

