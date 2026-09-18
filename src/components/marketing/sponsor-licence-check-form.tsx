"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The lookup itself isn't wired to any data source yet, so submitting
// discloses that honestly rather than faking a found/not-found result.
export function SponsorLicenceCheckForm() {
  const [checked, setChecked] = useState(false);

  if (checked) {
    return (
      <Card className="mx-auto w-full max-w-lg items-center gap-3 p-8 text-center">
        <h3 className="text-lg font-semibold">Lookups aren&apos;t live yet</h3>
        <p className="text-sm text-muted-foreground">
          We&apos;re still connecting this to the Home Office register. Try the full{" "}
          <a href="/visa-sponsors" className="underline">
            sponsor directory
          </a>{" "}
          once it&apos;s live, or check back here soon.
        </p>
        <Button variant="outline" onClick={() => setChecked(false)}>
          Check another company
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg p-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setChecked(true);
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">Company name</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="companyName"
              name="companyName"
              required
              placeholder="e.g. Deloitte"
              className="pl-8"
            />
          </div>
        </div>
        <Button type="submit" size="lg">
          Check licence status
        </Button>
      </form>
    </Card>
  );
}
