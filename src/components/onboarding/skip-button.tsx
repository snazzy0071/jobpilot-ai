import { skipOnboarding } from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/button";

export function SkipOnboardingButton() {
  return (
    <form action={skipOnboarding}>
      <Button type="submit" variant="ghost" size="sm">
        Skip for now
      </Button>
    </form>
  );
}
