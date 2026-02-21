import { Resend } from 'resend'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

interface EquipmentRequestEmailData {
    userName: string
    userEmail: string
    itemName: string
    category: string
    details: string
    requestId: string
}

interface BenefitDeclarationEmailData {
    userName: string
    userEmail: string
    benefitType: 'medical' | 'sport'
    variantName: string
    declarationId: string
}

/**
 * Send email notification for equipment request
 */
export async function sendEquipmentRequestEmail(
    recipientEmail: string,
    data: EquipmentRequestEmailData
) {
    try {
        const { error } = await resend.emails.send({
            from: 'ComPass System <noreply@compass.b2bnetwork.pl>',
            to: recipientEmail,
            subject: `[SPRZĘT] Nowe zgłoszenie od ${data.userName}`,
            html: `
                <h2>Nowe zgłoszenie sprzętowe</h2>
                <p><strong>Użytkownik:</strong> ${data.userName} (${data.userEmail})</p>
                <p><strong>Typ:</strong> ${data.itemName}</p>
                <p><strong>Kategoria:</strong> ${data.category}</p>
                <p><strong>ID zgłoszenia:</strong> ${data.requestId}</p>
                <hr />
                <h3>Szczegóły:</h3>
                <pre>${data.details}</pre>
                <hr />
                <p><em>Wiadomość wygenerowana automatycznie przez system ComPass</em></p>
            `,
        })

        if (error) {
            console.error('Resend error:', error)
            throw new Error(`Failed to send email: ${error.message}`)
        }

        return { success: true }
    } catch (err) {
        console.error('Email sending failed:', err)
        // Don't throw - we don't want to fail the request if email fails
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
}

/**
 * Send email notification for benefit declaration
 */
export async function sendBenefitDeclarationEmail(
    recipientEmail: string,
    data: BenefitDeclarationEmailData
) {
    const benefitTypeLabel = data.benefitType === 'medical' ? 'Pakiet Medyczny (PZU)' : 'Pakiet Sportowy (FitProfit)'

    try {
        const { error } = await resend.emails.send({
            from: 'ComPass System <noreply@compass.b2bnetwork.pl>',
            to: recipientEmail,
            subject: `[BENEFITY] Nowa deklaracja od ${data.userName}`,
            html: `
                <h2>Nowa deklaracja benefitowa</h2>
                <p><strong>Użytkownik:</strong> ${data.userName} (${data.userEmail})</p>
                <p><strong>Typ benefitu:</strong> ${benefitTypeLabel}</p>
                <p><strong>Wybrany wariant:</strong> ${data.variantName}</p>
                <p><strong>ID deklaracji:</strong> ${data.declarationId}</p>
                <hr />
                <p><em>Wiadomość wygenerowana automatycznie przez system ComPass</em></p>
            `,
        })

        if (error) {
            console.error('Resend error:', error)
            throw new Error(`Failed to send email: ${error.message}`)
        }

        return { success: true }
    } catch (err) {
        console.error('Email sending failed:', err)
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
}

/**
 * Send broadcast announcement email to a single user
 */
export async function sendBroadcastEmail(
    recipientEmail: string,
    senderName: string,
    title: string,
    content: string
) {
    try {
        const { error } = await resend.emails.send({
            from: 'ComPass System <noreply@compass.b2bnetwork.pl>',
            to: recipientEmail,
            subject: `[COMPASS] ${title}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #0e4d6e, #1a1a2e); padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <h1 style="color: #22d3ee; font-size: 20px; margin: 0;">ComPass</h1>
                    </div>
                    <div style="padding: 32px;">
                        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                            <p style="color: #fbbf24; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: bold;">Ogłoszenie</p>
                            <h2 style="color: #ffffff; font-size: 18px; margin: 0;">${title}</h2>
                        </div>
                        <div style="color: #d1d5db; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${content}</div>
                        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;" />
                        <p style="color: #6b7280; font-size: 12px; margin: 0;">Nadawca: <strong>${senderName}</strong></p>
                        <p style="color: #6b7280; font-size: 11px; margin-top: 16px;">
                            Wiadomość wygenerowana automatycznie przez system ComPass.
                        </p>
                    </div>
                </div>
            `,
        })

        if (error) {
            console.error('Resend broadcast error:', error)
            throw new Error(`Failed to send broadcast email: ${error.message}`)
        }

        return { success: true }
    } catch (err) {
        console.error('Broadcast email failed:', err)
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
}
