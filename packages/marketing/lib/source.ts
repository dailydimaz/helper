import { loader } from "fumadocs-core/source";
import { createOpenAPI } from "fumadocs-openapi/server";
import { icons } from "lucide-react";
import { createElement } from "react";
import { docs } from "@/.source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  pageTree: {
    // attachFile: attachFile as any, // Temporarily disabled due to runtime error
  },
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }

    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});

export const openapi = createOpenAPI();
