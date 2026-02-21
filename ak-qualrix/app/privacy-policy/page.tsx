import Link from 'next/link'

export const metadata = { title: 'Polityka prywatności | ComPass' }

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-background p-8 text-foreground max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Polityka prywatności</h1>
            <p className="text-muted-foreground mb-6">
                Strona w przygotowaniu. Treść polityki prywatności i informacje o przetwarzaniu danych osobowych (RODO) zostaną udostępnione wkrótce.
            </p>
            <Link href="/login" className="text-primary hover:underline">← Powrót do logowania</Link>
        </div>
    )
}
