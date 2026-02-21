import Link from 'next/link'

export const metadata = { title: 'Regulamin | ComPass' }

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background p-8 text-foreground max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Terms of Service / Regulamin</h1>
            <p className="text-muted-foreground mb-6">
                Strona w przygotowaniu. Regulamin korzystania z usługi ComPass zostanie udostępniony wkrótce.
            </p>
            <Link href="/login" className="text-primary hover:underline">← Powrót do logowania</Link>
        </div>
    )
}
