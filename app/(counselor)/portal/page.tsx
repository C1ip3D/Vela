import { TopBar } from "@/components/layout/TopBar";
import { getMockCounselorStudents, getMockAdvisorLogs } from "@/lib/canvas/client";
import { AlertTriangle, TrendingDown, CheckCircle, FileText } from "lucide-react";

const riskColor = (risk: string) => risk === "high" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : risk === "medium" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
const riskLabel = (risk: string) => risk === "high" ? "High Risk" : risk === "medium" ? "Monitor" : "On Track";

export default function CounselorPortalPage() {
  const students = getMockCounselorStudents();
  const alerts = getMockAdvisorLogs();
  const pendingAlerts = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Counselor Portal" studentName="Ms. Rivera" alertCount={pendingAlerts} />
      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Students", value: students.length, icon: null },
            { label: "Pending Alerts", value: pendingAlerts, warn: true },
            { label: "High Risk", value: students.filter(s => s.risk === "high").length, warn: true },
            { label: "On Track", value: students.filter(s => s.risk === "low").length },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[#1F2D4A] bg-[#141C33] p-4">
              <p className="text-xs uppercase tracking-wider text-[#94A3B8] mb-1">{s.label}</p>
              <p className={`font-mono text-3xl font-bold ${s.warn ? "text-amber-400" : "text-[#E2E8F0]"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Student roster */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-[#94A3B8]">Student Roster</h2>
            <div className="rounded-xl border border-[#1F2D4A] bg-[#141C33] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1F2D4A]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">GPA</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Missing</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2D4A]">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-[#1A2340] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">{s.displayName[0]}</div>
                          <span className="text-sm text-[#E2E8F0]">{s.displayName}</span>
                          {s.alerts > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-bold">{s.alerts}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[#E2E8F0]">{s.gpa.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${s.missingCount > 0 ? "text-amber-400" : "text-[#475569]"}`}>{s.missingCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${riskColor(s.risk)}`}>{riskLabel(s.risk)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                          <FileText size={11} /> Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alert queue */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-[#94A3B8]">Alert Queue</h2>
            {alerts.map((alert) => (
              <div key={alert.id} className={`rounded-xl border bg-[#141C33] p-3 ${alert.severity === "CRITICAL" ? "border-l-2 border-rose-500 border-[#1F2D4A]" : "border-l-2 border-amber-400 border-[#1F2D4A]"}`}>
                <div className="flex items-start gap-2">
                  {alert.severity === "CRITICAL" ? <TrendingDown size={14} className="text-rose-400 mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#E2E8F0]">Alex Chen</p>
                    <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">{alert.title}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="rounded bg-[#1A2340] px-2 py-1 text-xs text-[#94A3B8] hover:text-[#E2E8F0] transition-colors">Acknowledge</button>
                  <button className="rounded bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30 transition-colors">View Profile</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
