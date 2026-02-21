import { getAdminReferrals } from '@/lib/actions/referrals'
import { ReferralsAdminClient } from '@/components/admin/ReferralsAdminClient'
import { ProtectedPage } from '@/components/common/ProtectedPage'

export default async function AdminReferralsPage() {
    const referrals = await getAdminReferrals()

    return (
        <ProtectedPage feature="referrals">
            <div>
                <h1 className="text-3xl font-bold text-white">Zarządzanie Rekomendacjami</h1>
                <p className="text-muted-foreground">Weryfikuj i zarządzaj poleceniami projektowymi od konsultantów.</p>
            </div>

            <ReferralsAdminClient initialReferrals={referrals} />
        </ProtectedPage>
    )
}
