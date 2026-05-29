import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://developers.boomin.ai",
  integrations: [
    starlight({
      title: "Boomin Developers",
      description: "Build creator programs, connect partners, and automate Boomin with scoped SDKs and the Platform API.",
      logo: {
        src: "./src/assets/boomin-mark.svg",
        alt: "Boomin"
      },
      favicon: "/favicon.svg",
      social: [
        { icon: "github", label: "Boomin", href: "https://boomin.ai" }
      ],
      customCss: ["./src/styles/custom.css"],
      editLink: {
        baseUrl: "https://github.com/boomin-ai/boomin/edit/main/developers/"
      },
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Overview", slug: "index" },
            { label: "Quickstart", slug: "quickstart" },
            { label: "Roadmap", slug: "roadmap" }
          ]
        },
        {
          label: "Creator Connect",
          items: [
            { label: "Browser SDK", slug: "creator-connect/browser-sdk" },
            { label: "Account-first Flow", slug: "creator-connect/account-first" },
            { label: "Signed Handoff", slug: "creator-connect/signed-handoff" },
            { label: "Admin Approval", slug: "creator-connect/admin-approval" }
          ]
        },
        {
          label: "CLI",
          items: [
            { label: "CLI Guide", slug: "cli" },
            { label: "Token Commands", slug: "cli/tokens" },
            { label: "MCP", slug: "cli/mcp" }
          ]
        },
        {
          label: "Platform API",
          items: [
            { label: "Platform Overview", slug: "platform-api" },
            { label: "API Safety", slug: "tokens-scopes/safety" },
            { label: "Scope Reference", slug: "tokens-scopes/scopes" }
          ]
        },
        {
          label: "Examples",
          items: [
            { label: "React Creator Flow", slug: "examples/react" },
            { label: "Atlantium Reference", slug: "examples/atlantium" }
          ]
        },
        {
          label: "API Reference",
          items: [
            { label: "Creator Connect API", link: "/api/connect/" },
            { label: "Platform API", link: "/api/platform/" }
          ]
        }
      ]
    })
  ]
});
