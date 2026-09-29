import { getAppSettings } from "@/lib/admin/settings/queries";
import { AppSettingsForm } from "@/components/admin/settings/app-settings-form";
import { SettingsSectionNav } from "@/components/settings/settings-section-nav";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "settings-signups", label: "Sign-ups", description: "Maintenance mode" },
  { id: "settings-announcement", label: "Announcement", description: "Banner for signed-in users" },
];

export default async function AdminSettingsPage() {
  const settings = await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <SettingsSectionNav items={SECTIONS} />
        <AppSettingsForm settings={settings} />
      </div>
    </div>
  );
}
