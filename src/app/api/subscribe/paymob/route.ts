import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAYMOB_API_KEY = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const PAYMOB_IFRAME_ID = process.env.PAYMOB_IFRAME_ID;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get('planId');
    const amountUSD = parseFloat(searchParams.get('amount') || '0');

    if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID || !PAYMOB_IFRAME_ID) {
        return NextResponse.json({ error: 'Paymob configuration missing' }, { status: 500 });
    }

    try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession?.user) {
            return NextResponse.redirect(new URL('/login', req.url));
        }

        const user = authSession.user;

        // 1. Authentication Request
        const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: PAYMOB_API_KEY }),
        });
        const { token } = await authRes.json();

        // 2. Order Registration
        // Convert USD to EGP (Assume 50 for now, or you can use a live API)
        const amountEGP = Math.round(amountUSD * 50 * 100); // Amount in cents/piastres

        const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_token: token,
                delivery_needed: 'false',
                amount_cents: amountEGP,
                currency: 'EGP',
                items: [],
            }),
        });
        const orderData = await orderRes.json();

        // 3. Payment Key Generation
        const keyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_token: token,
                amount_cents: amountEGP,
                expiration: 3600,
                order_id: orderData.id,
                billing_data: {
                    apartment: 'NA',
                    email: user.email || 'customer@example.com',
                    floor: 'NA',
                    first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Customer',
                    street: 'NA',
                    building: 'NA',
                    phone_number: '+201234567890',
                    shipping_method: 'NA',
                    postal_code: 'NA',
                    city: 'Cairo',
                    country: 'EG',
                    last_name: user.user_metadata?.full_name?.split(' ')[1] || 'User',
                    state: 'NA',
                },
                currency: 'EGP',
                integration_id: parseInt(PAYMOB_INTEGRATION_ID),
            }),
        });
        const { token: paymentToken } = await keyRes.json();

        // 4. Redirect to Paymob Iframe
        return NextResponse.redirect(`https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`);

    } catch (error: any) {
        console.error('Paymob Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
