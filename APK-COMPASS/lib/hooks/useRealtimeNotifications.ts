'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

interface UseRealtimeNotificationsOptions {
    userId: string
    onNewNotification?: (notification: any) => void
    enabled?: boolean
}

export function useRealtimeNotifications({
    userId,
    onNewNotification,
    enabled = true,
}: UseRealtimeNotificationsOptions) {
    const handleNewNotification = useCallback(
        (payload: any) => {
            const notification = payload.new
            if (notification) {
                toast.info(notification.title_pl || notification.title || 'Nowe powiadomienie', {
                    description: notification.body_pl || notification.body || '',
                    action: notification.action_url
                        ? {
                              label: 'Zobacz',
                              onClick: () => {
                                  window.location.href = notification.action_url
                              },
                          }
                        : undefined,
                })
                onNewNotification?.(notification)
            }
        },
        [onNewNotification]
    )

    useEffect(() => {
        if (!enabled || !userId) return

        const supabase = createClient()

        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                handleNewNotification
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, enabled, handleNewNotification])
}
