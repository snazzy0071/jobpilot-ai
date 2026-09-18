import { Reveal } from "@/components/motion/reveal";

export type JourneyStep = {
  title: string;
  description: string;
};

export function JourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, index) => (
        <Reveal
          key={step.title}
          as="li"
          className="flex flex-col gap-2"
          delay={Math.min(index * 0.06, 0.3)}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {index + 1}
          </span>
          <p className="font-medium">{step.title}</p>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </Reveal>
      ))}
    </ol>
  );
}
