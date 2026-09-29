import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { listAdminInstitutions } from "@/lib/admin/institutions/queries";
import { CreateInstitutionForm } from "@/components/admin/institutions/create-institution-form";

export const dynamic = "force-dynamic";

export default async function AdminInstitutionsPage() {
  const institutions = await listAdminInstitutions();

  return (
    <div className="flex flex-col gap-6">
      <CreateInstitutionForm />

      {institutions.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No institutions yet.</Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Licence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {institutions.map((institution) => (
              <TableRow key={institution.id}>
                <TableCell>
                  <Link href={`/admin/institutions/${institution.id}`} className="font-medium hover:underline">
                    {institution.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{institution.slug}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{institution.memberCount}</TableCell>
                <TableCell>
                  <Badge variant={institution.hasActiveLicence ? "tinted" : "secondary"}>{institution.hasActiveLicence ? "Active" : "None"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
