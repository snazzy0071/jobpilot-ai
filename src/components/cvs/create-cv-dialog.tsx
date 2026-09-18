"use client";

import { useActionState, useState, type ReactElement } from "react";
import { PlusIcon } from "lucide-react";
import { createCv, type CvActionResult } from "@/lib/cvs/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CvFormMessage } from "@/components/cvs/form-message";
import { CV_TEMPLATES, CV_TEMPLATE_LAYOUTS, CV_TEMPLATE_LAYOUT_LABELS } from "@/config/cv-templates";

export function CreateCvDialog({ trigger }: { trigger?: ReactElement } = {}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CvActionResult, FormData>(createCv, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button><PlusIcon /> New CV</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new CV</DialogTitle>
          <DialogDescription>Give it a name and pick a starting template — you can change both later.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} placeholder="e.g. Graduate Software Engineer CV" autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template">Template</Label>
            <Select name="template" defaultValue={CV_TEMPLATES[0].slug}>
              <SelectTrigger id="template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CV_TEMPLATE_LAYOUTS.map((layout) => (
                  <SelectGroup key={layout}>
                    <SelectLabel>{CV_TEMPLATE_LAYOUT_LABELS[layout]}</SelectLabel>
                    {CV_TEMPLATES.filter((t) => t.layout === layout).map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can browse all 24 templates with sector/experience filters from the editor.
            </p>
          </div>

          <CvFormMessage state={state} />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create CV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
