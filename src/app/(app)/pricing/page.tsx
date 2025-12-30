'use client';
import React, { useState } from 'react';
import { Check, Sparkles, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function PricingPage() {
    const [isHolidaySeason, setIsHolidaySeason] = React.useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);

    React.useEffect(() => {
        const now = new Date();
        const isActive = now.getFullYear() === 2026 && now.getMonth() === 0;
        setIsHolidaySeason(isActive);
    }, []);

    const plans = [
        {
            id: 'price_starter',
            name: 'Starter',
            originalPrice: '19',
            discountedPrice: '9.5',
            description: 'مثالي للأفراد والمشاريع الناشئة',
            features: [
                'ربط حساب واتساب واحد',
                'حتى 1,000 رسالة آليّة شهرياً',
                'تقارير أداء أساسية',
                'دعم فني عبر البريد',
            ],
            popular: false,
        },
        {
            id: 'price_business',
            name: 'Business',
            originalPrice: '49',
            discountedPrice: '24.5',
            description: 'الخيار الأفضل للشركات الصغيرة والمتوسطة',
            features: [
                'ربط حتى 3 حسابات واتساب',
                'رسائل آليّة غير محدودة',
                'ردود ذكية (AI) متقدمة',
                'تقارير تحليلية مفصلة',
                'دعم فني ذو أولوية',
            ],
            popular: true,
        },
        {
            id: 'price_enterprise',
            name: 'Enterprise',
            originalPrice: '99',
            discountedPrice: '49.5',
            description: 'للمؤسسات التي تحتاج لفعالية قصوى',
            features: [
                'ربط حتى 10 حسابات واتساب',
                'كل ميزات باقة الأعمال',
                'مدير حساب خاص',
                'تدريب مخصص للفريق',
                'دعم عبر الواتساب والاتصال',
            ],
            popular: false,
        },
    ];

    const getPrice = (plan: any) => {
        return isHolidaySeason ? plan.discountedPrice : plan.originalPrice;
    };

    const handleSubscribe = (plan: any) => {
        setSelectedPlan(plan);
        setShowPaymentDialog(true);
    };

    const openWhatsApp = (method: string) => {
        const message = `مرحباً، أود الاشتراك في باقة ${selectedPlan.name} عبر ${method}.`;
        window.open(`https://wa.me/201281861935?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handlePaymobSubscribe = () => {
        if (!selectedPlan) return;
        const amount = getPrice(selectedPlan);
        window.location.href = `/api/subscribe/paymob?planId=${selectedPlan.id}&amount=${amount}`;
    };

    return (
        <div className="py-12 px-4 max-w-7xl mx-auto">
            {/* Payment Selection Dialog */}
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent className="sm:max-w-[500px] text-right" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold mb-4">اختر وسيلة الدفع</DialogTitle>
                        <DialogDescription>
                            أنت تشترك الآن في باقة <span className="font-bold text-primary">{selectedPlan?.name}</span> بسعر <span className="font-bold text-primary">${selectedPlan ? getPrice(selectedPlan) : ''}</span> شهرياً.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-6">
                        {/* Paymob */}
                        <div
                            onClick={() => handlePaymobSubscribe()}
                            className="p-4 border rounded-xl hover:border-primary cursor-pointer transition-all flex items-center gap-4 group"
                        >
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                <CreditCard className="h-6 w-6" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold">بطاقة ائتمانية / Paymob</h4>
                                <p className="text-sm text-muted-foreground">تفعيل فوري وآمن</p>
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">متاح</Badge>
                        </div>

                        {/* InstaPay */}
                        <div
                            onClick={() => openWhatsApp('انستاباي')}
                            className="p-4 border rounded-xl hover:border-primary cursor-pointer transition-all flex items-center gap-4 group"
                        >
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Banknote className="h-6 w-6" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold">تحويل عبر InstaPay</h4>
                                <p className="text-sm text-muted-foreground">تحويل بنكي مباشر وسهل</p>
                            </div>
                        </div>

                        {/* Vodafone Cash */}
                        <div
                            onClick={() => openWhatsApp('فودافون كاش')}
                            className="p-4 border rounded-xl hover:border-primary cursor-pointer transition-all flex items-center gap-4 group"
                        >
                            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
                                <Smartphone className="h-6 w-6" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold">فودافون كاش</h4>
                                <p className="text-sm text-muted-foreground">أسهل وسيلة دفع في مصر</p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="text-center mb-16">
                {isHolidaySeason && (
                    <Badge className="mb-4 bg-red-100 text-red-600 border-red-200 px-4 py-1 text-sm font-bold animate-bounce">
                        عرض رأس السنة الجديد: خصم 50% لفترة محدودة! 🎄
                    </Badge>
                )}
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4">
                    اختر الباقة المناسبة لنجاح عملك
                </h1>
                <p className="text-xl text-muted-foreground">
                    استخدم قوة الواتساب والذكاء الاصطناعي لزيادة مبيعاتك وتطوير خدمة عملائك.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan) => (
                    <Card
                        key={plan.name}
                        className={`relative flex flex-col h-full transition-all hover:shadow-xl ${plan.popular ? 'border-primary ring-2 ring-primary ring-opacity-50 scale-105 z-10' : ''
                            }`}
                    >
                        {plan.popular && (
                            <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                <Sparkles className="h-4 w-4" /> الخيار الأفضل
                            </div>
                        )}

                        <CardHeader>
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>

                        <CardContent className="flex-1">
                            <div className="mb-8">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold text-primary">${getPrice(plan)}</span>
                                    {isHolidaySeason && (
                                        <span className="text-xl text-muted-foreground line-through">${plan.originalPrice}</span>
                                    )}
                                    <span className="text-muted-foreground">/شهرياً</span>
                                </div>
                                {isHolidaySeason && (
                                    <p className="text-sm text-red-500 font-medium mt-1">توفير 50% بمناسبة رأس السنة!</p>
                                )}
                            </div>

                            <ul className="space-y-3">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <Check className="h-3 w-3 text-green-600" />
                                        </div>
                                        <span className="text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>

                        <CardFooter>
                            <Button
                                className="w-full text-lg h-12"
                                variant={plan.popular ? 'default' : 'outline'}
                                onClick={() => handleSubscribe(plan)}
                            >
                                اشترك الآن
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            <div className="mt-20 text-center bg-muted/50 rounded-2xl p-8 border border-dashed">
                <h3 className="text-xl font-bold mb-2">هل تحتاج لباقة مخصصة؟</h3>
                <p className="text-muted-foreground mb-4">لدينا حلول مخصصة للشركات الكبرى والاحتياجات الضخمة.</p>
                <Button variant="link" className="text-primary font-bold" onClick={() => window.open('https://wa.me/201281861935', '_blank')}>تواصل معنا عبر واتساب مباشرة</Button>
            </div>
        </div>
    );
}
