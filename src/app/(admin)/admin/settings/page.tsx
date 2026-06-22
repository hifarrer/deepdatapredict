import { prisma } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { CATEGORY_ORDER, orderCategories } from "@/lib/kalshi/categories";
import { SPORTS_ORDER, orderSports } from "@/lib/kalshi/sports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSettingsForm, PasswordForm } from "../_components/SettingsForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Settings" };

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  // Show an input for every known category: the canonical list, plus any that
  // appear in the latest snapshot or already have a configured limit.
  const snapshot = await prisma.eventSnapshot.findUnique({
    where: { id: "live" },
    select: { categories: true },
  });
  const snapshotCategories = Array.isArray(snapshot?.categories)
    ? (snapshot.categories as string[])
    : [];
  const categories = orderCategories([
    ...CATEGORY_ORDER,
    ...snapshotCategories,
    ...Object.keys(settings.categoryLimits),
  ]);
  const sports = orderSports([
    ...SPORTS_ORDER,
    ...Object.keys(settings.sportLimits),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Site configuration and admin account.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live event limits</CardTitle>
        </CardHeader>
        <CardContent>
          <SiteSettingsForm
            maxLiveEvents={settings.maxLiveEvents}
            defaultCategoryLimit={settings.defaultCategoryLimit}
            categoryLimits={settings.categoryLimits}
            categories={categories}
            defaultSportLimit={settings.defaultSportLimit}
            sportLimits={settings.sportLimits}
            sports={sports}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change admin password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
