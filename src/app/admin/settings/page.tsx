import { getAppSettings } from "@/lib/admin/settings/queries";
import { AppSettingsForm } from "@/components/admin/settings/app-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Global settings</h1>
        <p className="mt-1 text-muted-foreground">Platform-wide controls — every setting here is real and wired in, not just stored.</p>
      </div>
      <AppSettingsForm settings={settings} />
    </div>
  );
}
