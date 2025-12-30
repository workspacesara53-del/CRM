'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminSubscriptions() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            // Joining with auth.users is tricky from client side, we get what we have in public tables
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSubscriptions(data || []);
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const activateSubscription = async (userId: string, days: number = 30) => {
        try {
            const endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + days);

            const { error } = await (supabase
                .from('subscriptions') as any)
                .update({
                    status: 'active',
                    plan_type: 'business',
                    subscription_ends_at: endsAt.toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (error) throw error;

            toast({
                title: 'تم التفعيل بنجاح',
                description: `المستخدم الآن في الخطة النشطة لمدة ${days} يوم.`,
            });
            fetchSubscriptions();
        } catch (err: any) {
            toast({
                title: 'خطأ',
                description: err.message,
                variant: 'destructive'
            });
        }
    };

    const filteredSubs = subscriptions.filter(sub =>
        sub.user_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">إدارة الاشتراكات 💳</h1>
                <div className="relative w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="البحث برقم المستخدم..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستخدمين</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{subscriptions.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">نشطين حالياً</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {subscriptions.filter(s => s.status === 'active').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">فترة تجريبية</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {subscriptions.filter(s => s.status === 'trial').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="border rounded-lg bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">المستخدم</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                            <TableHead className="text-right">نوع الباقة</TableHead>
                            <TableHead className="text-right">ينتهي في</TableHead>
                            <TableHead className="text-left font-bold">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSubs.map((sub) => (
                            <TableRow key={sub.id}>
                                <TableCell className="font-mono text-xs">{sub.user_id}</TableCell>
                                <TableCell>
                                    {sub.status === 'active' ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-200">
                                            <CheckCircle className="h-3 w-3 ml-1" /> نشط
                                        </Badge>
                                    ) : sub.status === 'trial' ? (
                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                            <Clock className="h-3 w-3 ml-1" /> تجريبي
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">
                                            <AlertCircle className="h-3 w-3 ml-1" /> منتهي
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="capitalize">{sub.plan_type}</TableCell>
                                <TableCell>
                                    {new Date(sub.subscription_ends_at || sub.trial_ends_at).toLocaleDateString('ar-EG')}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => activateSubscription(sub.user_id, 30)}
                                            variant={sub.status === 'active' ? 'outline' : 'default'}
                                        >
                                            تفعيل 30 يوم
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => activateSubscription(sub.user_id, 365)}
                                            variant="outline"
                                        >
                                            تفعيل سنة
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
