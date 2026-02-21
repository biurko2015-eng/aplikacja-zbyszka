import { createClient } from '@/lib/supabase/server'
import { CandidatesListClient } from "@/components/admin/CandidatesListClient"
import { SearchInput } from "@/components/admin/SearchInput"
import { SortSelect } from "@/components/admin/SortSelect"
import { ProtectedPage } from '@/components/common/ProtectedPage'

export default async function AdminCandidatesPage({
    searchParams
}: {
    searchParams?: {
        q?: string
        sort?: string
        page?: string
    }
}) {
    const supabase = createClient()
    const query = searchParams?.q || ''
    const sort = searchParams?.sort || 'newest'
    const page = parseInt(searchParams?.page || '1')
    const pageSize = 12

    // Fetch only needed columns (skip embedding, bio full text etc.)
    const { data: allCandidates, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, avatar_url, skills, experience_years, current_status, created_at, verifier_status, ambassador_status, sales_support_status, bio, cv_url')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching candidates:', error)
    }

    // Client-side filtering for comprehensive search (Tags, Bio, Roles, Skills)
    let candidates = (allCandidates || []).filter(c => {
        if (!query) return true;
        const lowerQuery = query.toLowerCase();

        // 1. Basic Fields
        if (c.full_name?.toLowerCase().includes(lowerQuery)) return true;
        if (c.email?.toLowerCase().includes(lowerQuery)) return true;
        if (c.bio?.toLowerCase().includes(lowerQuery)) return true;

        // 2. Skills Array
        if (c.skills && Array.isArray(c.skills)) {
            if (c.skills.some((skill: string) => skill.toLowerCase().includes(lowerQuery))) return true;
        }

        // 3. Roles (Polish mapping)
        if (c.verifier_status === 'active' && 'weryfikator'.includes(lowerQuery)) return true;
        if (c.ambassador_status === 'active' && 'ambasador'.includes(lowerQuery)) return true;
        if (c.sales_support_status === 'active' && 'sprzedaż'.includes(lowerQuery)) return true;
        if (c.sales_support_status === 'active' && 'sales'.includes(lowerQuery)) return true;

        // 4. Status
        if (c.current_status === 'free_capacity' && 'wolny'.includes(lowerQuery)) return true;
        if (c.current_status === 'busy' && 'zajęty'.includes(lowerQuery)) return true;

        return false;
    });

    // Sorting
    candidates = candidates.sort((a, b) => {
        if (sort === 'oldest') {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sort === 'exp_desc') {
            return (b.experience_years || 0) - (a.experience_years || 0);
        }
        if (sort === 'exp_asc') {
            return (a.experience_years || 0) - (b.experience_years || 0);
        }
        if (sort === 'alpha_asc') {
            return (a.full_name || '').localeCompare(b.full_name || '');
        }
        // Default: newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })

    // Pagination
    const totalPages = Math.ceil(candidates.length / pageSize)
    const paginatedCandidates = candidates.slice((page - 1) * pageSize, page * pageSize)

    // Pre-fetch match summaries from cache (match_results table) — NO expensive RPC calls
    // This uses already-computed results. If no cached results exist, show 0 (user can trigger scoring from detail page)
    const candidateIds = paginatedCandidates.map(c => c.id)
    const matchCounts: Record<string, { total: number, high: number, medium: number, low: number }> = {}

    if (candidateIds.length > 0) {
        try {
            const { data: cachedResults } = await supabase
                .from('match_results')
                .select('candidate_id, score')
                .in('candidate_id', candidateIds)

            if (cachedResults) {
                for (const r of cachedResults) {
                    if (!matchCounts[r.candidate_id]) {
                        matchCounts[r.candidate_id] = { total: 0, high: 0, medium: 0, low: 0 }
                    }
                    const counts = matchCounts[r.candidate_id]
                    counts.total++
                    const sim = (r.score || 0) / 100
                    if (sim >= 0.9) counts.high++
                    else if (sim >= 0.7) counts.medium++
                    else if (sim >= 0.5) counts.low++
                }
            }
        } catch {
            // match_results table may not exist yet — graceful degradation
        }
    }

    const candidatesWithMatches = paginatedCandidates.map(c => {
        const counts = matchCounts[c.id] || { total: 0, high: 0, medium: 0, low: 0 }
        const pseudoMatches = [
            ...Array(counts.high).fill({ similarity: 0.95 }),
            ...Array(counts.medium).fill({ similarity: 0.75 }),
            ...Array(counts.low).fill({ similarity: 0.55 })
        ]
        return { ...c, matches: pseudoMatches }
    })

    return (
        <ProtectedPage feature="candidates">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Baza Konsultantów</h1>
                    <p className="text-muted-foreground">
                        Lista zweryfikowanych konsultantów i ich dostępność.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {query && (
                        <div className="flex items-center">
                            <a href="/admin/candidates" className="text-xs text-muted-foreground hover:text-white mr-2">
                                Wyczyść filtry ✕
                            </a>
                        </div>
                    )}
                    <SearchInput placeholder="Szukaj konsultanta..." />
                    <SortSelect />
                </div>
            </div>

            <CandidatesListClient
                candidates={candidatesWithMatches}
                currentPage={page}
                totalPages={totalPages}
                totalCount={candidates.length}
            />
        </ProtectedPage>
    )
}
