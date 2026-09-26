"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLinkedinDraft } from "@/lib/linkedin/actions";
import { LINKEDIN_TARGET_SENIORITIES, LINKEDIN_TARGET_SENIORITY_LABELS, type LinkedinTargetSeniority } from "@/lib/linkedin/types";

/**
 * No LinkedIn sign-in anywhere here — every field is text the user
 * pastes in by hand (this feature's own "without LinkedIn credentials"
 * scope). Submitting both creates the draft row and runs its first
 * rewrite in one step (`createLinkedinDraft`); there's no intermediate
 * "saved but not generated yet" state to redirect to.
 */
export function LinkedinDraftCreateForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetSeniority, setTargetSeniority] = useState<LinkedinTargetSeniority>("mid");
  const [currentHeadline, setCurrentHeadline] = useState("");
  const [currentAbout, setCurrentAbout] = useState("");
  const [currentExperience, setCurrentExperience] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    setLoading(true);
    let response: Awaited<ReturnType<typeof createLinkedinDraft>>;
    try {
      response = await createLinkedinDraft(formData);
    } catch {
      // A dropped connection rejects the Server Action call itself — without this the button stayed on "Generating…".
      setLoading(false);
      setError("Couldn't reach the server — check your connection and try again.");
      return;
    }

    if ("error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push(`/dashboard/linkedin/${response.draftId}`);
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedin-draft-title">Draft name</Label>
            <Input
              id="linkedin-draft-title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="e.g. Product Manager switch"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linkedin-draft-role">Target role</Label>
            <Input
              id="linkedin-draft-role"
              name="targetRole"
              value={targetRole}
              onChange={(event) => setTargetRole(event.target.value)}
              maxLength={200}
              placeholder="e.g. Product Manager"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="linkedin-draft-seniority">Target seniority</Label>
          <Select
            name="targetSeniority"
            value={targetSeniority}
            items={LINKEDIN_TARGET_SENIORITY_LABELS}
            onValueChange={(value) => value && setTargetSeniority(value as LinkedinTargetSeniority)}
          >
            <SelectTrigger id="linkedin-draft-seniority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINKEDIN_TARGET_SENIORITIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {LINKEDIN_TARGET_SENIORITY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="linkedin-draft-headline">Current headline (optional)</Label>
          <Input
            id="linkedin-draft-headline"
            name="currentHeadline"
            value={currentHeadline}
            onChange={(event) => setCurrentHeadline(event.target.value)}
            maxLength={220}
            placeholder="Paste your current LinkedIn headline, if you have one"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="linkedin-draft-about">Current About section (optional)</Label>
          <Textarea
            id="linkedin-draft-about"
            name="currentAbout"
            rows={5}
            maxLength={2600}
            value={currentAbout}
            onChange={(event) => setCurrentAbout(event.target.value)}
            placeholder="Paste your current About section, if you have one"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="linkedin-draft-experience">Current Experience section</Label>
          <Textarea
            id="linkedin-draft-experience"
            name="currentExperience"
            rows={10}
            maxLength={8000}
            value={currentExperience}
            onChange={(event) => setCurrentExperience(event.target.value)}
            placeholder="Paste your current Experience section — job titles, employers, and the bullet points under each"
            required
          />
          <p className="text-xs text-muted-foreground">
            The rewrite is grounded only in what you paste here — nothing about your roles or achievements is invented.
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" variant="gradient" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2Icon className="animate-spin" /> Generating…
            </>
          ) : (
            "Generate rewrite"
          )}
        </Button>
      </form>
    </Card>
  );
}
