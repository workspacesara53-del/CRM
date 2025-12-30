'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface Subscription {
    status: string;
    trial_ends_at: string;
    subscription_ends_at: string | null;
}

interface SubscriptionContextType {
    subscription: Subscription | null;
    loading: boolean;
    isExpired: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
    subscription: null,
    loading: true,
    isExpired: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkSubscription = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setLoading(false);
                    return;
                }

                // Fetch subscription
                const { data, error } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                if (error) throw error;

                // If no subscription record, create one (7 day trial)
                if (!data) {
                    const { data: newSub, error: insertError } = await (supabase
                        .from('subscriptions') as any)
                        .insert({
                            user_id: session.user.id,
                            status: 'trial',
                            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        })
                        .select()
                        .single();

                    if (!insertError) setSubscription(newSub);
                } else {
                    setSubscription(data);
                }
            } catch (err) {
                console.error('Error checking subscription:', err);
            } finally {
                setLoading(false);
            }
        };

        checkSubscription();
    }, []);

    const isExpired = React.useMemo(() => {
        if (!subscription) return false;

        const now = new Date();
        const trialEnd = new Date(subscription.trial_ends_at);
        const subEnd = subscription.subscription_ends_at ? new Date(subscription.subscription_ends_at) : null;

        if (subscription.status === 'active' && subEnd && now < subEnd) return false;
        if (subscription.status === 'trial' && now < trialEnd) return false;

        return true;
    }, [subscription]);

    useEffect(() => {
        // Redirect logic
        if (!loading && isExpired && !pathname.startsWith('/pricing') && !pathname.startsWith('/login')) {
            router.push('/pricing');
        }
    }, [loading, isExpired, pathname, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <SubscriptionContext.Provider value={{ subscription, loading, isExpired }}>
            {children}
        </SubscriptionContext.Provider>
    );
}
