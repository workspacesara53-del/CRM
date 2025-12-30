import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-01-27' as any,
});

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const priceId = searchParams.get('priceId');

    if (!priceId) {
        return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
    }

    try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (!authSession?.user) {
            return NextResponse.redirect(new URL('/login', req.url));
        }

        const userId = authSession.user.id;
        const userEmail = authSession.user.email;

        // Mapping plan IDs to real prices (In a real app, you'd use Stripe Price IDs)
        // For now, we simulate with a dummy checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `WaCRM ${priceId.replace('price_', '').toUpperCase()} Plan`,
                        },
                        unit_amount: priceId === 'price_starter' ? 1900 : priceId === 'price_business' ? 4900 : 9900,
                        recurring: { interval: 'month' },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/chat?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/pricing`,
            customer_email: userEmail,
            client_reference_id: userId,
            metadata: {
                userId: userId,
                planType: priceId,
            },
        });

        return NextResponse.redirect(session.url as string, 303);
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
