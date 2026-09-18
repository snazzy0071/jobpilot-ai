import { FeatureCard } from "@/components/marketing/feature-card";
import type { Tool } from "@/config/tools";

export function RelatedTools({ tools }: { tools: Tool[] }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
      {tools.map((tool) => (
        <FeatureCard
          key={tool.slug}
          icon={tool.icon}
          title={tool.title}
          description={tool.shortDescription}
          href={tool.href}
        />
      ))}
    </div>
  );
}
