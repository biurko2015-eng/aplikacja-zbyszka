import { redirect } from 'next/navigation'
import { getUnifiedDashboardData } from '@/lib/actions/unified-dashboard'
import { UnifiedDashboardClient } from '@/components/dashboard/UnifiedDashboardClient'

export default async function HomePage() {
    // ─── PERF: Single call — getUnifiedDashboardData handles auth + profile + role ───
    const data = await getUnifiedDashboardData()

    if (!data.success) {
        redirect('/login')
    }

    return (
        <UnifiedDashboardClient
            role={data.role || 'consultant'}
            centralaSubRole={data.centralaSubRole}
            userProfile={data.userProfile}
            centralaStats={data.centralaStats}
            consultantsList={data.consultantsList}
            consultantDashboard={data.consultantDashboard}
            adminKpi={data.adminKpi}
            recruiterInfo={data.recruiterInfo}
            adminDashboardData={data.adminDashboardData}
            isSuperAdmin={data.isSuperAdmin}
        />
    )
}
