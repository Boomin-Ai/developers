import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://developers.boomin.ai",
  integrations: [
    starlight({
      title: "Boomin Developers",
      description: "Programmable distribution infrastructure: partnerships, distributions, deployments, and performance through @boomin/sdk and the Platform API.",
      // The real Boomin mark. What was here was the Starlight/Astro default
      // triangle recoloured cyan + violet — same silhouette, never our logo.
      logo: {
        src: "./src/assets/boomin-mark.png",
        alt: "Boomin"
      },
      favicon: "/favicon.png",
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
            { label: "The distribution model", slug: "concepts/model" },
            { label: "Authentication", slug: "concepts/authentication" },
            { label: "Pricing", slug: "pricing" },
            { label: "Roadmap", slug: "roadmap" }
          ]
        },
        {
          label: "SDK",
          items: [
            { label: "Install & client", slug: "sdk" },
            { label: "Errors", slug: "sdk/errors" },
            { label: "Receiving webhooks", slug: "sdk/webhooks" },
            {
              label: "Resources",
              items: [
                { label: "programs", slug: "sdk/resources/programs" },
                { label: "partners", slug: "sdk/resources/partners" },
                { label: "partnerships", slug: "sdk/resources/partnerships" },
                { label: "enrollments", slug: "sdk/resources/enrollments" },
                { label: "distributions", slug: "sdk/resources/distributions" },
                { label: "deployments", slug: "sdk/resources/deployments" },
                { label: "connections", slug: "sdk/resources/connections" },
                { label: "performance", slug: "sdk/resources/performance" },
                { label: "events", slug: "sdk/resources/events" },
                { label: "operations", slug: "sdk/resources/operations" },
                { label: "webhooks", slug: "sdk/resources/webhooks" },
                { label: "payouts", slug: "sdk/resources/payouts" },
                { label: "payouts.rules", slug: "sdk/resources/payout-rules" },
                { label: "payouts.rails", slug: "sdk/resources/payout-rails" },
                { label: "payouts.batches", slug: "sdk/resources/payout-batches" }
              ]
            },
            {
              label: "Partner Connect (browser)",
              items: [
                { label: "Browser SDK", slug: "partner-connect/browser-sdk" },
                { label: "Account-first Flow", slug: "partner-connect/account-first" },
                { label: "Signed Handoff", slug: "partner-connect/signed-handoff" },
                { label: "Admin Approval", slug: "partner-connect/admin-approval" },
                { label: "Discover Listing", slug: "partner-programs/discover" },
                { label: "In-app Dashboards", slug: "partner-programs/dashboard" },
                { label: "Example: React", slug: "examples/react" },
                { label: "Example: Atlantium", slug: "examples/atlantium" }
              ]
            }
          ]
        },
        {
          label: "Distributions",
          items: [
            { label: "Overview", slug: "distributions" },
            { label: "Lifecycle & launching", slug: "distributions/lifecycle" },
            { label: "Deployments", slug: "distributions/deployments" },
            { label: "Budgets", slug: "distributions/budgets" },
            { label: "Performance", slug: "distributions/performance" }
          ]
        },
        {
          label: "Payouts",
          items: [
            { label: "Getting partners paid", slug: "payouts" },
            { label: "The payout ledger", slug: "distributions/payouts" }
          ]
        },
        {
          label: "CLI",
          items: [
            { label: "CLI Guide", slug: "cli" },
            { label: "Command Reference", slug: "cli/reference" },
            { label: "Token Commands", slug: "cli/tokens" }
          ]
        },
        {
          label: "MCP",
          items: [{ label: "Boomin MCP", slug: "mcp" }]
        },
        {
          label: "API Reference",
          items: [
            { label: "Platform API v1", slug: "platform-api" },
            { label: "Scope Reference", slug: "tokens-scopes/scopes" },
            { label: "API Safety", slug: "tokens-scopes/safety" },
            { label: "OpenAPI: Platform", link: "/api/platform/" },
            { label: "OpenAPI: Partner Connect", link: "/api/connect/" }
          ]
        }
      ]
    })
  ]
});
