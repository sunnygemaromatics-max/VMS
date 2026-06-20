"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LiveHeadcountCard } from "@/components/dashboard/LiveHeadcountCard";
import { VisitorsTable } from "@/components/dashboard/VisitorsTable";
import { ComplianceStatus } from "@/components/dashboard/ComplianceStatus";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { ComplianceAlerts } from "@/components/dashboard/ComplianceAlerts";
import { VisitsChart } from "@/components/dashboard/VisitsChart";
import { VisitsHeatmap } from "@/components/dashboard/VisitsHeatmap";
import { AnomaliesBanner } from "@/components/dashboard/AnomaliesBanner";
import { NoticesWidget } from "@/components/dashboard/NoticesWidget";
import { OccupancyByCompany } from "@/components/dashboard/OccupancyByCompany";
import { DashboardHeader } from "@/components/dashboard-header";
import { useI18n } from "@/lib/i18n";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen w-full">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6">
        <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              {t('dash.liveOccupancy')}
            </h2>
            <div className="mt-2 h-1 w-16 rounded-full bg-brand-gradient" />
          </div>
          <BranchFilter value={branchId} onChange={setBranchId} />
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LiveHeadcountCard branchId={branchId} />
          </div>
          <div>
            <OccupancyByCompany branchId={branchId} />
          </div>
        </div>

        <NoticesWidget />
        <ComplianceAlerts />
        <AnomaliesBanner />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VisitsChart />
          <VisitsHeatmap />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 pb-12">
          <div className="lg:col-span-2">
            <VisitorsTable branchId={branchId} />
          </div>
          <div>
            <ComplianceStatus />
          </div>
        </div>
      </div>
    </main>
  );
}
