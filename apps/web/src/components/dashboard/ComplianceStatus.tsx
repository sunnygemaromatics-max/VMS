"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ComplianceRow {
  contractorId: string;
  companyName: string;
  totalWorkers: number;
  compliantWorkers: number;
  complianceScore: number;
  status: "COMPLIANT" | "WARNING";
}

function StatusIcon({ score }: { score: number }) {
  if (score >= 90)
    return <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />;
  if (score >= 60)
    return <AlertCircle className="w-6 h-6 text-yellow-500 shrink-0" />;
  return <Zap className="w-6 h-6 text-red-500 shrink-0" />;
}

export function ComplianceStatus() {
  const { t } = useI18n();
  const [rows, setRows] = useState<ComplianceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiGet<ComplianceRow[]>("/compliance");
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load compliance");
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-6">
        {t('dash.complianceStatus')}
      </h3>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {!rows && !error && (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm text-zinc-500">
          No contractors yet. Add one to see compliance scores.
        </p>
      )}

      <div className="space-y-4">
        {rows?.map((row, index) => (
          <motion.div
            key={row.contractorId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="flex items-center gap-4 p-4 rounded-lg border border-white/5 hover:bg-white/5 transition-colors"
          >
            <StatusIcon score={row.complianceScore} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {row.companyName}
              </p>
              <p className="text-sm text-zinc-400">
                {t('dash.compliantOf', { a: row.compliantWorkers, b: row.totalWorkers })}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-lg font-semibold ${
                  row.complianceScore >= 90
                    ? "text-green-400"
                    : row.complianceScore >= 60
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {row.complianceScore}%
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
