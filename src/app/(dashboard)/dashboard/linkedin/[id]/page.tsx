import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLinkedinDraftDetail } from "@/lib/linkedin/queries";
import { Button } from "@/components/ui/button";
import { LinkedinDraftDetail } from "@/components/linkedin/linkedin-draft-detail";

export const dynamic = "force-dynamic";

export default async function LinkedinDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const draft = await getLinkedinDraftDetail(user.id, id);
  if (!draft) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={
          <Link href="/dashboard/linkedin">
            <ArrowLeftIcon /> All drafts
          </Link>
        }
      />

      <h1 className="font-heading text-2xl font-semibold tracking-tight">{draft.title}</h1>

      {/* Keyed by updatedAt so a whole-draft "Regenerate everything" (which
          replaces headline variants, About, and every Experience bullet —
          new ids included) forces a clean remount with fresh server data,
          instead of this client component's useState hooks keeping their
          stale initial values across a router.refresh(). */}
      <LinkedinDraftDetail key={draft.updatedAt} draft={draft} />
    </div>
  );
}
