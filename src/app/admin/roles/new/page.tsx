import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleForm } from "@/components/admin/roles/role-form";

export default function NewAdminRolePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/roles"><ArrowLeftIcon /> Roles</Link>} />
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">New admin role</h1>
      </div>
      <RoleForm />
    </div>
  );
}
