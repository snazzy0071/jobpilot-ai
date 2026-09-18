import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminRoleById } from "@/lib/admin/roles/queries";
import { RoleForm } from "@/components/admin/roles/role-form";

export default async function EditAdminRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getAdminRoleById(id);
  if (!role) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/roles"><ArrowLeftIcon /> Roles</Link>} />
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit {role.name}</h1>
      </div>
      <RoleForm role={role} />
    </div>
  );
}
