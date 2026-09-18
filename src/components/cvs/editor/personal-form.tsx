"use client";

import { useRef } from "react";
import { savePersonal } from "@/lib/cvs/section-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import type { CvPersonal } from "@/lib/cvs/types";

export function PersonalForm({ versionId, initial }: { versionId: string; initial: CvPersonal | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { setLivePersonal } = useCvPreview();
  const { status, errorMessage, scheduleSave } = useAutosave(savePersonal);

  function handleChange() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setLivePersonal({
      fullName: String(formData.get("fullName") ?? ""),
      headline: (String(formData.get("headline") ?? "") || null) as string | null,
      email: (String(formData.get("email") ?? "") || null) as string | null,
      phone: (String(formData.get("phone") ?? "") || null) as string | null,
      location: (String(formData.get("location") ?? "") || null) as string | null,
      websiteUrl: (String(formData.get("websiteUrl") ?? "") || null) as string | null,
      linkedinUrl: (String(formData.get("linkedinUrl") ?? "") || null) as string | null,
      portfolioUrl: (String(formData.get("portfolioUrl") ?? "") || null) as string | null,
    });
    scheduleSave(formData);
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" required defaultValue={initial?.fullName ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            name="headline"
            placeholder="e.g. Graduate Software Engineer"
            defaultValue={initial?.headline ?? ""}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} maxLength={320} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} maxLength={40} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={initial?.location ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="websiteUrl">Website</Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://"
            defaultValue={initial?.websiteUrl ?? ""}
            maxLength={500}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="linkedinUrl">LinkedIn</Label>
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            placeholder="https://"
            defaultValue={initial?.linkedinUrl ?? ""}
            maxLength={500}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="portfolioUrl">Portfolio</Label>
          <Input
            id="portfolioUrl"
            name="portfolioUrl"
            type="url"
            placeholder="https://"
            defaultValue={initial?.portfolioUrl ?? ""}
            maxLength={500}
          />
        </div>
      </div>

      <AutosaveStatus status={status} errorMessage={errorMessage} />
    </form>
  );
}
