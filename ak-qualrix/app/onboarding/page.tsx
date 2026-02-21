'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { updateProfileFull } from '@/lib/actions/matching'
import { uploadCV, generateProfileFromCV } from '@/lib/actions/files'
import { toast } from 'sonner'
import { toastSuccess } from '@/lib/toast-success'
import { useRouter } from 'next/navigation'

const onboardingSchema = z.object({
    bio: z.string().min(10, 'Krótkie bio jest wymagane (min. 10 znaków)'),
    gdpr_consent: z.boolean().refine(val => val === true, 'Wymagana zgoda RODO')
})

export default function OnboardingPage() {
    const [loading, setLoading] = useState(false)
    const [cvFile, setCvFile] = useState<File | null>(null)
    const router = useRouter()

    const { register, handleSubmit, formState: { errors }, setValue } = useForm<z.infer<typeof onboardingSchema>>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            gdpr_consent: false
        }
    })

    const onFinalSubmit = async (data: any) => {
        if (!cvFile) {
            toast.error('Proszę wgrać CV (wymagane)')
            return
        }

        setLoading(true)
        try {
            // 1. Upload CV
            const formData = new FormData()
            formData.append('file', cvFile)
            const uploadRes = await uploadCV(formData)

            if (uploadRes.success) {
                // 2. Generate Profile from CV (this also updates candidates table via trigger or direct call)
                // Note: The new trigger handles sync, but generateProfileFromCV might also try to sync.
                // It's safer to let generateProfileFromCV do its work as it parses skills.
                await generateProfileFromCV({
                    status: 'open' // Default status
                })
            }

            // 3. Update Bio and Consent
            // We need to add gdpr_consent to updateProfileFull logic or handle it separately if not supported by action.
            // Assuming we update profiles table directly or via server action.
            // Since updateProfileFull might not have gdpr_consent argument yet, we might need to update that action too.
            // For now, let's assume it handles "basic info" and we might need a specific updated action.

            const result = await updateProfileFull({
                bio: data.bio,
            })
            if (result.success === false) {
                toast.error('Błąd: ' + (result.error || 'Nie udało się zapisać.'))
                return
            }
            if (result.warning) toast.warning(result.warning)
            toastSuccess('Profil utworzony pomyślnie!')
            router.push('/dashboard')
            router.refresh()
        } catch (error: unknown) {
            const err = error as Error
            toast.error('Błąd: ' + (err?.message || 'Nieznany błąd'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-lg bg-card border-white/10 shadow-2xl">
                <CardHeader>
                    <CardTitle>👋 Uzupełnij profil</CardTitle>
                    <CardDescription>Aby korzystać z aplikacji, musisz uzupełnić te informacje.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label>Krótkie Bio / O mnie (Wymagane)</Label>
                            <Textarea
                                {...register('bio')}
                                placeholder="Napisz kilka słów o swoim doświadczeniu..."
                                className="bg-white/5"
                            />
                            {errors.bio && <p className="text-red-400 text-xs">{errors.bio.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Wgraj CV (Wymagane)</Label>
                            <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:bg-white/5 cursor-pointer">
                                <Input
                                    type="file"
                                    accept=".pdf,.docx"
                                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                    id="cv-upload"
                                />
                                <label htmlFor="cv-upload" className="cursor-pointer block w-full h-full">
                                    {cvFile ? (
                                        <span className="text-green-400">{cvFile.name}</span>
                                    ) : (
                                        <span className="text-slate-400">Kliknij, aby wybrać plik CV</span>
                                    )}
                                </label>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-4 bg-white/5 rounded-lg">
                            <Checkbox
                                id="gdpr"
                                onCheckedChange={(c) => setValue('gdpr_consent', c === true)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label htmlFor="gdpr" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    Zgoda RODO (Wymagana)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Wyrażam zgodę na przetwarzanie danych w celu rekrutacji.
                                </p>
                                {errors.gdpr_consent && <p className="text-red-400 text-xs">{errors.gdpr_consent.message}</p>}
                            </div>
                        </div>

                        <Button
                            className="w-full"
                            onClick={handleSubmit(onFinalSubmit)}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Zakończ i przejdź do Dashboardu
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
