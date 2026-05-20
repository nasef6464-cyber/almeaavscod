import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle, CreditCard, DollarSign, Download, ExternalLink, Eye, EyeOff, Landmark, LockKeyhole, Save, Search, TrendingUp, Unlock, Users, Wallet } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';
import { DiscountCode, PackageContentType, PaymentRequest, PaymentRequestStatus, PaymentSettings, Role } from '../../types';
import { isMockQuiz, isTrainingQuiz } from '../../utils/quizPlacement';

type TransactionRow = {
    id: string;
    user: string;
    type: string;
    amount: string;
    date: string;
    status: string;
};

const BuildingIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
        <path d="M9 22v-4h6v4"></path>
        <path d="M8 6h.01"></path>
        <path d="M16 6h.01"></path>
        <path d="M12 6h.01"></path>
        <path d="M12 10h.01"></path>
        <path d="M12 14h.01"></path>
        <path d="M16 10h.01"></path>
        <path d="M16 14h.01"></path>
        <path d="M8 10h.01"></path>
        <path d="M8 14h.01"></path>
    </svg>
);

const defaultSettings: PaymentSettings = {
    key: 'default',
    currency: 'SAR',
    manualReviewRequired: true,
    card: { enabled: true, label: 'بطاقة بنكية', providerName: 'Tap / MyFatoorah / HyperPay / Paymob / Fawry', providerCode: 'manual_card', gatewayMode: 'manual_review', supportedCountries: ['SA', 'EG'], instructions: '' },
    transfer: { enabled: true, label: 'تحويل بنكي', bankName: '', accountName: '', accountNumber: '', iban: '', providerName: 'Bank transfer', providerCode: 'manual_transfer', gatewayMode: 'manual_review', supportedCountries: ['SA', 'EG'], instructions: '', publishDetailsToStudents: true },
    wallet: { enabled: true, label: 'محفظة إلكترونية', providerName: 'STC Pay / Vodafone Cash / Fawry', providerCode: 'manual_wallet', gatewayMode: 'manual_review', supportedCountries: ['SA', 'EG'], phoneNumber: '', instructions: '', publishDetailsToStudents: true },
    notes: '',
};

const paymentCountryOptions = [
    { code: 'SA', label: 'السعودية' },
    { code: 'EG', label: 'مصر' },
];

const paymentProviderPresets = {
    card: [
        { code: 'tap', label: 'Tap Payments', countries: ['SA'] },
        { code: 'myfatoorah', label: 'MyFatoorah', countries: ['SA'] },
        { code: 'hyperpay', label: 'HyperPay', countries: ['SA'] },
        { code: 'paymob', label: 'Paymob', countries: ['EG'] },
        { code: 'fawry', label: 'Fawry', countries: ['EG'] },
    ],
    transfer: [
        { code: 'manual_transfer', label: 'تحويل بنكي يدوي', countries: ['SA', 'EG'] },
    ],
    wallet: [
        { code: 'stc_pay', label: 'STC Pay', countries: ['SA'] },
        { code: 'vodafone_cash', label: 'Vodafone Cash', countries: ['EG'] },
        { code: 'fawry_wallet', label: 'Fawry Wallet', countries: ['EG'] },
    ],
} as const;

const downloadCsv = (fileName: string, rows: Array<Array<string | number>>) => {
    const escapeCell = (cell: string | number) => {
        const value = String(cell ?? '');
        return `"${value.replace(/"/g, '""')}"`;
    };
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const FinancialManager: React.FC = () => {
    const { users, groups, b2bPackages, accessCodes, courses, paths, subjects, lessons, quizzes, libraryItems, updateCourse, updateB2BPackage } = useStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'settings' | 'discounts' | 'b2b' | 'b2c' | 'transactions'>('overview');
    const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
    const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
    const [settings, setSettings] = useState<PaymentSettings>(defaultSettings);
    const [loading, setLoading] = useState(false);
    const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);
    const [requestStatusFilter, setRequestStatusFilter] = useState<PaymentRequestStatus | 'all'>('pending');
    const [requestSearchTerm, setRequestSearchTerm] = useState('');
    const [discountForm, setDiscountForm] = useState<DiscountCode>({
        code: '',
        label: '',
        type: 'percentage',
        value: 10,
        status: 'active',
        minAmount: 0,
        maxRedemptions: 0,
        packageIds: [],
        pathIds: [],
        subjectIds: [],
        contentTypes: [],
    });
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const loadPaymentData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [settingsResponse, requestsResponse, discountCodesResponse] = await Promise.all([
                    api.getPaymentSettings(),
                    api.getPaymentRequests(),
                    api.getDiscountCodes(),
                ]);

                if (cancelled) return;
                setSettings(settingsResponse as PaymentSettings);
                setPaymentRequests(((requestsResponse as { requests?: PaymentRequest[] })?.requests || []).map((request) => ({
                    ...request,
                    id: String(request.id),
                    userId: String(request.userId),
                })));
                setDiscountCodes(((discountCodesResponse as { codes?: DiscountCode[] })?.codes || []).map((code) => ({
                    ...code,
                    code: String(code.code || '').toUpperCase(),
                })));
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل بيانات المالية الآن.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadPaymentData();
        return () => {
            cancelled = true;
        };
    }, []);

    const schools = useMemo(() => groups.filter((group) => group.type === 'SCHOOL'), [groups]);
    const teachers = useMemo(() => users.filter((currentUser) => currentUser.role === Role.TEACHER), [users]);
    const schoolPackageIds = useMemo(() => new Set(b2bPackages.map((pkg) => pkg.id)), [b2bPackages]);
    const publicPackages = useMemo(() => courses.filter((course) => course.isPackage), [courses]);
    const publicPackageIds = useMemo(() => new Set(publicPackages.map((pkg) => pkg.id)), [publicPackages]);
    const b2cPremiumUsers = useMemo(() => users.filter((user) => {
        const purchasedPackages = user.subscription?.purchasedPackages || [];
        const hasPublicPackage = purchasedPackages.some((packageId) => publicPackageIds.has(packageId));
        const hasOnlySchoolPackages = purchasedPackages.length > 0 && purchasedPackages.every((packageId) => schoolPackageIds.has(packageId));
        return hasPublicPackage || (user.subscription?.plan === 'premium' && !hasOnlySchoolPackages);
    }), [publicPackageIds, schoolPackageIds, users]);
    const activePackages = useMemo(() => b2bPackages.filter((pkg) => pkg.status === 'active'), [b2bPackages]);
    const activeCodes = useMemo(() => accessCodes.filter((code) => code.expiresAt > Date.now()), [accessCodes]);

    const estimatedB2BRevenue = useMemo(() => {
        return activePackages.reduce((sum, pkg) => {
            const courseValue = (pkg.courseIds || []).reduce((courseSum, courseId) => {
                const course = courses.find((item) => item.id === courseId);
                return courseSum + (course?.price || 0);
            }, 0);

            return sum + (courseValue * Math.max(pkg.maxStudents || 0, 0));
        }, 0);
    }, [activePackages, courses]);

    const estimatedB2CRevenue = b2cPremiumUsers.length * 199;
    const approvedRevenue = paymentRequests
        .filter((request) => request.status === 'approved')
        .reduce((sum, request) => sum + (request.amount || 0), 0);
    const pendingRevenue = paymentRequests
        .filter((request) => request.status === 'pending')
        .reduce((sum, request) => sum + (request.amount || 0), 0);
    const estimatedTotalRevenue = estimatedB2BRevenue + estimatedB2CRevenue + approvedRevenue;
    const totalCapacity = activePackages.reduce((sum, pkg) => sum + (pkg.maxStudents || 0), 0);
    const totalCodeUsage = activeCodes.reduce((sum, code) => sum + (code.currentUses || 0), 0);
    const utilizationRate = totalCapacity > 0 ? Math.round((totalCodeUsage / totalCapacity) * 100) : 0;
    const averageCustomerValue = users.length > 0 ? Math.round(estimatedTotalRevenue / users.length) : 0;

    const pendingRequestsCount = paymentRequests.filter((request) => request.status === 'pending').length;

    const kpis = [
        {
            label: 'الإيرادات المثبتة + التقديرية',
            value: `${settings.currency} ${estimatedTotalRevenue.toLocaleString('en-US')}`,
            trend: `${pendingRequestsCount} طلب بانتظار المراجعة`,
            isPositive: true,
            icon: <DollarSign size={24} />,
        },
        {
            label: 'إجمالي طلبات الدفع المعلقة',
            value: `${pendingRequestsCount}`,
            trend: `${settings.currency} ${pendingRevenue.toLocaleString('en-US')} قيد المراجعة`,
            isPositive: pendingRequestsCount > 0,
            icon: <CreditCard size={24} />,
        },
        {
            label: 'باقات المدارس (B2B)',
            value: `${b2bPackages.length}`,
            trend: `${schools.length} جهة تعليمية`,
            isPositive: true,
            icon: <BuildingIcon />,
        },
        {
            label: 'متوسط قيمة العميل',
            value: `${settings.currency} ${averageCustomerValue.toLocaleString('en-US')}`,
            trend: `${utilizationRate}% معدل الاستخدام`,
            isPositive: utilizationRate >= 50,
            icon: <TrendingUp size={24} />,
        },
    ];

    const requestStatusLabel = (status: PaymentRequestStatus) => {
        switch (status) {
            case 'approved':
                return 'معتمد';
            case 'rejected':
                return 'مرفوض';
            case 'cancelled':
                return 'ملغي';
            default:
                return 'بانتظار المراجعة';
        }
    };

    const requestStatusClasses = (status: PaymentRequestStatus) => {
        switch (status) {
            case 'approved':
                return 'bg-emerald-100 text-emerald-700';
            case 'rejected':
            case 'cancelled':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-amber-100 text-amber-700';
        }
    };

    const requestMethodLabel = (method: PaymentRequest['paymentMethod']) => {
        switch (method) {
            case 'card':
                return 'بطاقة';
            case 'transfer':
                return 'تحويل بنكي';
            case 'wallet':
                return 'محفظة';
            default:
                return 'وسيلة دفع';
        }
    };

    const requestItemTypeLabel = (type: PaymentRequest['itemType']) => {
        switch (type) {
            case 'package':
                return 'باقة';
            case 'course':
                return 'دورة';
            case 'test':
                return 'اختبار';
            case 'skill':
                return 'مهارة';
            default:
                return 'محتوى';
        }
    };

    const requestDateLabel = (value?: string | number) => (
        new Date(value || Date.now()).toLocaleString('ar-SA', {
            dateStyle: 'medium',
            timeStyle: 'short',
        })
    );

    const requestRiskNotes = (request: PaymentRequest) => [
        request.status === 'pending' && request.paymentMethod === 'transfer' && !request.transferReference && !request.receiptUrl ? 'لا يوجد مرجع تحويل أو إيصال' : '',
        request.status === 'pending' && request.paymentMethod === 'wallet' && !request.walletNumber && !request.receiptUrl ? 'لا يوجد رقم محفظة أو إيصال' : '',
        request.status === 'pending' && request.paymentMethod === 'card' && !request.notes && !request.receiptUrl ? 'لا يوجد دليل مراجعة للبطاقة' : '',
        request.amount <= 0 ? 'المبلغ غير محدد' : '',
    ].filter(Boolean);

    const buildApprovalEvidence = (request: PaymentRequest) => [
        request.paymentMethod ? `method:${request.paymentMethod}` : '',
        request.transferReference ? `transfer:${request.transferReference}` : '',
        request.walletNumber ? `wallet:${request.walletNumber}` : '',
        request.receiptUrl ? `receipt:${request.receiptUrl}` : '',
        request.notes ? `notes:${request.notes}` : '',
    ].filter(Boolean).join(' | ');

    const paymentRequestStatusCounts = useMemo(() => ({
        all: paymentRequests.length,
        pending: paymentRequests.filter((request) => request.status === 'pending').length,
        approved: paymentRequests.filter((request) => request.status === 'approved').length,
        rejected: paymentRequests.filter((request) => request.status === 'rejected').length,
        cancelled: paymentRequests.filter((request) => request.status === 'cancelled').length,
    }), [paymentRequests]);

    const visiblePaymentRequests = useMemo(() => {
        const normalizedSearch = requestSearchTerm.trim().toLowerCase();

        return paymentRequests
            .filter((request) => requestStatusFilter === 'all' || request.status === requestStatusFilter)
            .filter((request) => {
                if (!normalizedSearch) return true;
                return [
                    request.id,
                    request.userName,
                    request.userEmail,
                    request.itemName,
                    request.transferReference,
                    request.walletNumber,
                    request.notes,
                    request.reviewerNotes,
                ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
            })
            .sort((a, b) => {
                const statusWeight = (request: PaymentRequest) => request.status === 'pending' ? 0 : request.status === 'approved' ? 1 : 2;
                return statusWeight(a) - statusWeight(b)
                    || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            });
    }, [paymentRequests, requestSearchTerm, requestStatusFilter]);

    const recentTransactions = useMemo<TransactionRow[]>(() => {
        const requestTransactions = paymentRequests.slice(0, 8).map((request) => ({
            id: request.id,
            user: request.userName || request.userEmail || 'مستخدم',
            type: `طلب ${request.itemType === 'package' ? 'باقة' : request.itemType === 'course' ? 'دورة' : request.itemType === 'test' ? 'اختبار' : 'مهارة'}`,
            amount: `${request.currency} ${request.amount.toLocaleString('en-US')}`,
            date: new Date(request.createdAt || Date.now()).toLocaleDateString('ar-SA'),
            status: requestStatusLabel(request.status),
        }));

        const schoolTransactions = activePackages.slice(0, 6).map((pkg) => ({
            id: `B2B-${pkg.id}`,
            user: groups.find((group) => group.id === pkg.schoolId)?.name || 'جهة تعليمية',
            type: `B2B (${pkg.name})`,
            amount: `${settings.currency} ${((pkg.maxStudents || 0) * 99).toLocaleString('en-US')}`,
            date: new Date(pkg.createdAt).toLocaleDateString('ar-SA'),
            status: pkg.status === 'active' ? 'نشط' : 'منتهي',
        }));

        return [...requestTransactions, ...schoolTransactions].slice(0, 10);
    }, [paymentRequests, activePackages, groups, settings.currency]);

    const schoolRows = useMemo(() => {
        return schools.map((school) => {
            const schoolPackages = b2bPackages.filter((pkg) => pkg.schoolId === school.id);
            const schoolCodes = accessCodes.filter((code) => code.schoolId === school.id);
            const activeSchoolCodes = schoolCodes.filter((code) => code.expiresAt > Date.now());
            const estimatedValue = schoolPackages.reduce((sum, pkg) => sum + ((pkg.maxStudents || 0) * 99), 0);
            const totalCapacity = schoolPackages.reduce((sum, pkg) => sum + (pkg.maxStudents || 0), 0);
            const usedSeats = schoolCodes.reduce((sum, code) => sum + (code.currentUses || 0), 0);

            return {
                id: school.id,
                name: school.name,
                packages: schoolPackages.length,
                activeCodes: activeSchoolCodes.length,
                estimatedValue,
                usedSeats,
                totalCapacity,
            };
        }).sort((a, b) => b.estimatedValue - a.estimatedValue);
    }, [accessCodes, b2bPackages, schools]);

    const contentTypeLabel = (type: PackageContentType) => {
        switch (type) {
            case 'courses':
                return 'الدورات';
            case 'foundation':
                return 'التأسيس';
            case 'banks':
                return 'التدريب';
            case 'tests':
                return 'الاختبارات';
            case 'library':
                return 'المكتبة';
            default:
                return 'كل المحتوى';
        }
    };

    const publicPackageRows = useMemo(() => {
        return publicPackages.map((pkg) => {
            const packageRequests = paymentRequests.filter((request) => (
                request.itemType === 'package' && (request.itemId === pkg.id || request.packageId === pkg.id)
            ));
            const approvedRequests = packageRequests.filter((request) => request.status === 'approved');
            const pendingRequests = packageRequests.filter((request) => request.status === 'pending');
            const purchasedUsers = users.filter((currentUser) => (currentUser.subscription?.purchasedPackages || []).includes(pkg.id));
            const contentTypes = pkg.packageContentTypes?.length ? pkg.packageContentTypes : ['all' as PackageContentType];
            const pathName = paths.find((path) => path.id === (pkg.pathId || pkg.category))?.name || 'عام';
            const subjectName = pkg.subjectId ? subjects.find((subject) => subject.id === pkg.subjectId)?.name : '';
            const coversAll = contentTypes.includes('all' as PackageContentType);
            const hasType = (type: PackageContentType) => coversAll || contentTypes.includes(type);
            const isInScope = (item: { pathId?: string; subjectId?: string }) => {
                const pathId = pkg.pathId || pkg.category;
                const subjectId = pkg.subjectId || pkg.subject;
                const pathMatches = !pathId || item.pathId === pathId;
                const subjectMatches = !subjectId || item.subjectId === subjectId;
                return pathMatches && subjectMatches;
            };
            const coverageCounts = {
                courses: courses.filter((course) => !course.isPackage && hasType('courses') && isInScope(course)).length,
                foundation: lessons.filter((lesson) => hasType('foundation') && isInScope(lesson)).length,
        banks: quizzes.filter((quiz) => hasType('banks') && isTrainingQuiz(quiz) && isInScope(quiz)).length,
        tests: quizzes.filter((quiz) => hasType('tests') && isMockQuiz(quiz) && isInScope(quiz)).length,
                library: libraryItems.filter((item) => hasType('library') && isInScope(item)).length,
            };
            const coveredItems = coverageCounts.courses + coverageCounts.foundation + coverageCounts.banks + coverageCounts.tests + coverageCounts.library;
            const readinessWarnings = [
                pkg.price <= 0 ? 'السعر غير محدد' : '',
                !(pkg.pathId || pkg.category) ? 'غير مربوطة بمسار' : '',
                coveredItems === 0 ? 'لا يوجد محتوى داخل نطاق الباقة' : '',
                pkg.showOnPlatform !== false && pkg.isPublished === false ? 'ظاهرة لكن غير منشورة' : '',
                pkg.showOnPlatform !== false && pkg.approvalStatus && pkg.approvalStatus !== 'approved' ? 'تحتاج اعتماد قبل البيع' : '',
            ].filter(Boolean);
            const scopeMode = pkg.subjectId || pkg.subject
                ? 'عرض مادة محددة'
                : (pkg.pathId || pkg.category)
                    ? 'عرض مسار كامل'
                    : 'عرض عام يحتاج ضبط';

            return {
                id: pkg.id,
                title: pkg.title,
                pathId: pkg.pathId || pkg.category || '',
                subjectId: pkg.subjectId || pkg.subject || '',
                pathName,
                subjectName,
                price: pkg.price || 0,
                originalPrice: pkg.originalPrice || 0,
                isVisible: pkg.showOnPlatform !== false && pkg.isPublished !== false && (!pkg.approvalStatus || pkg.approvalStatus === 'approved'),
                contentTypes,
                requests: packageRequests.length,
                pending: pendingRequests.length,
                buyers: purchasedUsers.length,
                revenue: approvedRequests.reduce((sum, request) => sum + (request.amount || 0), 0),
                coverageCounts,
                coveredItems,
                readinessWarnings,
                isReadyForSale: readinessWarnings.length === 0,
                scopeMode,
            };
        }).sort((a, b) => Number(b.isVisible) - Number(a.isVisible) || b.revenue - a.revenue);
    }, [courses, lessons, libraryItems, paths, paymentRequests, publicPackages, quizzes, subjects, users]);

    const togglePublicPackageVisibility = (packageId: string) => {
        const pkg = publicPackages.find((item) => item.id === packageId);
        if (!pkg) return;

        const isCurrentlyVisible =
            pkg.showOnPlatform !== false &&
            pkg.isPublished !== false &&
            (!pkg.approvalStatus || pkg.approvalStatus === 'approved');
        const nextVisible = !isCurrentlyVisible;

        updateCourse(packageId, {
            showOnPlatform: nextVisible,
            isPublished: nextVisible,
            approvalStatus: nextVisible ? 'approved' : 'draft',
            approvedAt: nextVisible ? Date.now() : undefined,
        });
        setFeedback(nextVisible ? 'تم إظهار الباقة العامة للطلاب.' : 'تم إخفاء الباقة العامة مؤقتًا بدون حذفها.');
    };

    const syncPublicPackagesByReadiness = () => {
        if (publicPackageRows.length === 0) {
            setFeedback('لا توجد باقات عامة لمزامنتها الآن.');
            return;
        }

        let shown = 0;
        let hidden = 0;

        publicPackageRows.forEach((pkg) => {
            const shouldBeVisible = pkg.isReadyForSale;
            updateCourse(pkg.id, {
                showOnPlatform: shouldBeVisible,
                isPublished: shouldBeVisible,
                approvalStatus: shouldBeVisible ? 'approved' : 'draft',
                approvedAt: shouldBeVisible ? Date.now() : undefined,
            });

            if (shouldBeVisible) {
                shown += 1;
            } else {
                hidden += 1;
            }
        });

        setFeedback(`تمت مزامنة الباقات العامة: إظهار ${shown} جاهزة، وإخفاء ${hidden} غير جاهزة.`);
    };

    const hideAllPublicPackages = () => {
        if (publicPackages.length === 0) {
            setFeedback('لا توجد باقات عامة لإخفائها.');
            return;
        }

        publicPackages.forEach((pkg) => {
            updateCourse(pkg.id, {
                showOnPlatform: false,
                isPublished: false,
                approvalStatus: 'draft',
                approvedAt: undefined,
            });
        });

        setFeedback(`تم إخفاء ${publicPackages.length} باقة عامة بدون حذفها.`);
    };

    const previewPublicPackage = (packageId: string) => {
        const pkg = publicPackages.find((item) => item.id === packageId);
        if (!pkg) return;

        const pathId = pkg.pathId || pkg.category;
        if (!pathId) return;
        const subjectId = pkg.subjectId || pkg.subject || subjects.find((subject) => subject.pathId === pathId)?.id;
        const query = subjectId ? `?subject=${subjectId}&tab=courses&package=${pkg.id}` : `?package=${pkg.id}`;
        window.open(`/#/category/${pathId}${query}`, '_blank', 'noopener,noreferrer');
    };

    const exportPublicPackages = () => {
        downloadCsv('public-packages-offers.csv', [
            ['اسم العرض', 'المسار', 'المادة', 'الحالة', 'جاهزية البيع', 'السعر', 'مشتركون', 'طلبات معلقة', 'تغطية المحتوى', 'ملاحظات'],
            ...publicPackageRows.map((pkg) => [
                pkg.title,
                pkg.pathName,
                pkg.subjectName || 'كل المواد',
                pkg.isVisible ? 'ظاهر' : 'مخفي',
                pkg.isReadyForSale ? 'جاهز' : 'يحتاج ضبط',
                pkg.price,
                pkg.buyers,
                pkg.pending,
                pkg.coveredItems,
                pkg.readinessWarnings.join(' | ') || 'لا توجد',
            ]),
        ]);
    };

    const exportPaymentRequests = () => {
        downloadCsv('payment-requests.csv', [
            ['رقم الطلب', 'الطالب', 'البريد', 'العنصر', 'نوع العنصر', 'طريقة الدفع', 'المبلغ قبل الخصم', 'الخصم', 'المبلغ النهائي', 'العملة', 'كود الخصم', 'الحالة', 'مرجع التحويل', 'رقم المحفظة', 'الإيصال', 'ملاحظات', 'تاريخ الإنشاء'],
            ...paymentRequests.map((request) => [
                request.id,
                request.userName || 'طالب',
                request.userEmail || '',
                request.itemName || '',
                request.itemType || '',
                request.paymentMethod || '',
                request.originalAmount ?? request.amount ?? 0,
                request.discountAmount || 0,
                request.amount || 0,
                request.currency || settings.currency,
                request.discountCode || '',
                requestStatusLabel(request.status),
                request.transferReference || '',
                request.walletNumber || '',
                request.receiptUrl || '',
                request.notes || '',
                new Date(request.createdAt || Date.now()).toLocaleDateString('ar-SA'),
            ]),
        ]);
    };

    const exportFinancialSnapshot = () => {
        downloadCsv('financial-operational-snapshot.csv', [
            ['البند', 'القيمة'],
            ['نسبة جاهزية الدفع', `${paymentReadinessScore}%`],
            ['ملاحظات الجاهزية', paymentReadinessWarnings.join(' | ') || 'لا توجد'],
            ['طلبات دفع معلقة', pendingRequestsCount],
            ['قيمة الطلبات المعلقة', pendingRevenue],
            ['إيراد معتمد', approvedRevenue],
            ['باقات عامة ظاهرة', publicPackagesSummary.visible],
            ['باقات عامة جاهزة للبيع', publicPackagesSummary.ready],
            ['باقات عامة تحتاج ضبط', publicPackagesSummary.needsSetup],
            ['باقات مدارس نشطة', schoolPackagesSummary.active],
            ['مقاعد مدارس مستخدمة', schoolPackagesSummary.usedSeats],
            ['إجمالي مقاعد المدارس', schoolPackagesSummary.totalSeats],
            ['معدل استخدام المقاعد', `${utilizationRate}%`],
        ]);
    };

    const toggleSchoolPackageStatus = (packageId: string, currentStatus: 'active' | 'expired') => {
        const nextStatus = currentStatus === 'active' ? 'expired' : 'active';
        updateB2BPackage(packageId, { status: nextStatus });
        setFeedback(nextStatus === 'active' ? 'تم تنشيط باقة المدرسة.' : 'تم إيقاف باقة المدرسة مؤقتًا بدون حذفها.');
    };

    const setAllSchoolPackagesStatus = (status: 'active' | 'expired') => {
        if (b2bPackages.length === 0) {
            setFeedback('لا توجد باقات مدارس لإدارتها الآن.');
            return;
        }

        b2bPackages.forEach((pkg) => {
            if (pkg.status !== status) {
                updateB2BPackage(pkg.id, { status });
            }
        });

        setFeedback(status === 'active' ? `تم تنشيط ${b2bPackages.length} باقة مدرسة.` : `تم إيقاف ${b2bPackages.length} باقة مدرسة مؤقتًا.`);
    };

    const packageCoverageRows = useMemo(() => {
        return b2bPackages.map((pkg) => {
            const packagePathIds = new Set(pkg.pathIds || []);
            const packageSubjectIds = new Set(pkg.subjectIds || []);
            const packageCourseIds = new Set(pkg.courseIds || []);
            const coversAll = (pkg.contentTypes || []).includes('all');
            const hasType = (type: PackageContentType) => coversAll || (pkg.contentTypes || []).includes(type);
            const isInScope = (item: { pathId?: string; subjectId?: string }) => {
                const pathMatches = packagePathIds.size === 0 || (item.pathId ? packagePathIds.has(item.pathId) : false);
                const subjectMatches = packageSubjectIds.size === 0 || (item.subjectId ? packageSubjectIds.has(item.subjectId) : false);
                return pathMatches && subjectMatches;
            };

            const scopedCourses = courses.filter((course) => packageCourseIds.has(course.id) || (hasType('courses') && isInScope(course)));
            const scopedLessons = lessons.filter((lesson) => hasType('foundation') && isInScope(lesson));
    const scopedTraining = quizzes.filter((quiz) => hasType('banks') && isTrainingQuiz(quiz) && isInScope(quiz));
    const scopedTests = quizzes.filter((quiz) => hasType('tests') && isMockQuiz(quiz) && isInScope(quiz));
            const scopedLibrary = libraryItems.filter((item) => hasType('library') && isInScope(item));
            const packageCodes = accessCodes.filter((code) => code.packageId === pkg.id);
            const activePackageCodes = packageCodes.filter((code) => code.expiresAt > Date.now());
            const usedSeats = packageCodes.reduce((sum, code) => sum + (code.currentUses || 0), 0);
            const seatRate = pkg.maxStudents > 0 ? Math.min(Math.round((usedSeats / pkg.maxStudents) * 100), 100) : 0;
            const teacher = teachers.find((currentTeacher) => currentTeacher.id === pkg.assignedTeacherId);
            const pathNames = (pkg.pathIds || [])
                .map((pathId) => paths.find((path) => path.id === pathId)?.name)
                .filter(Boolean);
            const subjectNames = (pkg.subjectIds || [])
                .map((subjectId) => subjects.find((subject) => subject.id === subjectId)?.name)
                .filter(Boolean);
            const totalItems = scopedCourses.length + scopedLessons.length + scopedTraining.length + scopedTests.length + scopedLibrary.length;
            const packageValue = scopedCourses.reduce((sum, course) => sum + (course.price || 0), 0) * Math.max(pkg.maxStudents || 0, 0);
            const teacherShare = pkg.revenueSharePercentage != null
                ? Math.round((packageValue * Math.max(0, Math.min(pkg.revenueSharePercentage, 100))) / 100)
                : 0;
            const scopeMode =
                packageCourseIds.size > 0
                    ? 'باقة مخصصة بمحتوى محدد'
                    : packageSubjectIds.size > 0
                        ? 'باقة مواد محددة'
                        : packagePathIds.size > 0
                            ? 'باقة مسارات كاملة'
                            : 'باقة وصول عام';
            const operationalWarnings = [
                totalItems === 0 ? 'لا يوجد محتوى فعلي داخل نطاق هذه الباقة' : '',
                activePackageCodes.length === 0 ? 'لا توجد أكواد مفعلة حاليًا لهذه الباقة' : '',
                pkg.status === 'active' && pkg.maxStudents > 0 && usedSeats >= pkg.maxStudents ? 'تم استهلاك كل المقاعد المتاحة' : '',
            ].filter(Boolean);

            return {
                id: pkg.id,
                name: pkg.name,
                schoolName: groups.find((group) => group.id === pkg.schoolId)?.name || 'جهة تعليمية',
                status: pkg.status,
                type: pkg.type,
                discountPercentage: pkg.discountPercentage,
                maxStudents: pkg.maxStudents,
                assignedTeacherName: teacher?.name || '',
                revenueSharePercentage: pkg.revenueSharePercentage,
                teacherShare,
                isActive: pkg.status === 'active',
                isPaused: pkg.status !== 'active',
                usedSeats,
                seatRate,
                activeCodes: activePackageCodes.length,
                contentTypes: pkg.contentTypes || ['all'],
                pathNames,
                subjectNames,
                totalItems,
                scopeMode,
                operationalWarnings,
                counts: {
                    courses: scopedCourses.length,
                    foundation: scopedLessons.length,
                    banks: scopedTraining.length,
                    tests: scopedTests.length,
                    library: scopedLibrary.length,
                },
            };
        }).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.usedSeats - a.usedSeats);
    }, [accessCodes, b2bPackages, courses, groups, lessons, libraryItems, paths, quizzes, subjects, teachers]);

    const schoolPackagesSummary = useMemo(() => ({
        total: packageCoverageRows.length,
        active: packageCoverageRows.filter((pkg) => pkg.isActive).length,
        paused: packageCoverageRows.filter((pkg) => pkg.isPaused).length,
        activeCodes: packageCoverageRows.reduce((sum, pkg) => sum + pkg.activeCodes, 0),
        usedSeats: packageCoverageRows.reduce((sum, pkg) => sum + pkg.usedSeats, 0),
        totalSeats: packageCoverageRows.reduce((sum, pkg) => sum + (pkg.maxStudents || 0), 0),
        teacherShares: packageCoverageRows.reduce((sum, pkg) => sum + (pkg.teacherShare || 0), 0),
    }), [packageCoverageRows]);

    const publicPackagesSummary = useMemo(() => ({
        total: publicPackageRows.length,
        visible: publicPackageRows.filter((pkg) => pkg.isVisible).length,
        hidden: publicPackageRows.filter((pkg) => !pkg.isVisible).length,
        ready: publicPackageRows.filter((pkg) => pkg.isReadyForSale).length,
        needsSetup: publicPackageRows.filter((pkg) => !pkg.isReadyForSale).length,
        pending: publicPackageRows.reduce((sum, pkg) => sum + pkg.pending, 0),
        buyers: publicPackageRows.reduce((sum, pkg) => sum + pkg.buyers, 0),
    }), [publicPackageRows]);

    const paymentReadinessWarnings = useMemo(() => {
        const enabledMethods = [settings.card, settings.transfer, settings.wallet].filter((method) => method.enabled).length;
        return [
            enabledMethods === 0 ? 'لا توجد وسيلة دفع مفعلة للطلاب.' : '',
            settings.transfer.enabled && settings.transfer.publishDetailsToStudents && !settings.transfer.iban && !settings.transfer.accountNumber
                ? 'التحويل البنكي مفعل لكن بيانات الحساب أو الآيبان غير مكتملة.'
                : '',
            settings.wallet.enabled && settings.wallet.publishDetailsToStudents && !settings.wallet.phoneNumber
                ? 'المحفظة الإلكترونية مفعلة لكن رقم الجوال/المحفظة غير مكتمل.'
                : '',
            settings.card.enabled && settings.card.gatewayMode === 'webhook' && !settings.webhookEnabled
                ? 'تم اختيار اعتماد آلي للبطاقة لكن Webhook الدفع غير مفعل.'
                : '',
            settings.wallet.enabled && settings.wallet.gatewayMode === 'webhook' && !settings.webhookEnabled
                ? 'تم اختيار اعتماد آلي للمحفظة لكن Webhook الدفع غير مفعل.'
                : '',
            settings.card.enabled && !(settings.card.supportedCountries || []).length
                ? 'الدفع بالبطاقة مفعل بدون تحديد دولة تشغيل.'
                : '',
            publicPackagesSummary.visible === 0 ? 'لا توجد باقات عامة ظاهرة للطلاب المستقلين.' : '',
            publicPackagesSummary.needsSetup > 0 ? `${publicPackagesSummary.needsSetup} باقة عامة تحتاج ضبط قبل البيع.` : '',
            schoolPackagesSummary.active === 0 && schools.length > 0 ? 'توجد مدارس لكن لا توجد باقات مدرسية نشطة.' : '',
            pendingRequestsCount > 0 ? `${pendingRequestsCount} طلب دفع ينتظر قرار الإدارة.` : '',
        ].filter(Boolean);
    }, [
        pendingRequestsCount,
        publicPackagesSummary.needsSetup,
        publicPackagesSummary.visible,
        schoolPackagesSummary.active,
        schools.length,
        settings.card,
        settings.transfer,
        settings.wallet,
    ]);

    const paymentReadinessScore = Math.max(0, 100 - paymentReadinessWarnings.length * 12);

    const premiumRows = useMemo(() => {
        return b2cPremiumUsers.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email || '-',
            courses: user.subscription?.purchasedCourses?.length || 0,
            packages: (user.subscription?.purchasedPackages || []).filter((packageId) => publicPackageIds.has(packageId)).length,
            plan: user.subscription?.plan || 'free',
            status: user.isActive === false ? 'موقوف' : 'نشط',
        }));
    }, [b2cPremiumUsers, publicPackageIds]);

    const discountSummary = useMemo(() => ({
        total: discountCodes.length,
        active: discountCodes.filter((code) => code.status === 'active').length,
        used: discountCodes.reduce((sum, code) => sum + (code.currentRedemptions || 0), 0),
        requestCount: paymentRequests.filter((request) => request.discountCode).length,
        savedAmount: paymentRequests.reduce((sum, request) => sum + (request.discountAmount || 0), 0),
    }), [discountCodes, paymentRequests]);

    const discountCodeRows = useMemo(() => {
        return discountCodes.map((code) => {
            const requests = paymentRequests.filter((request) => request.discountCode === code.code);
            const relatedPackages = publicPackages.filter((pkg) => code.packageIds?.includes(pkg.id));
            return {
                ...code,
                requests: requests.length,
                approvedRequests: requests.filter((request) => request.status === 'approved').length,
                totalDiscount: requests.reduce((sum, request) => sum + (request.discountAmount || 0), 0),
                packagesLabel: relatedPackages.length ? relatedPackages.map((pkg) => pkg.title).join('، ') : 'كل الباقات المطابقة للنطاق',
            };
        }).sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || (b.currentRedemptions || 0) - (a.currentRedemptions || 0));
    }, [discountCodes, paymentRequests, publicPackages]);

    const resetDiscountForm = () => {
        setDiscountForm({
            code: '',
            label: '',
            type: 'percentage',
            value: 10,
            status: 'active',
            minAmount: 0,
            maxRedemptions: 0,
            packageIds: [],
            pathIds: [],
            subjectIds: [],
            contentTypes: [],
        });
    };

    const saveSettings = async () => {
        setLoading(true);
        setError(null);
        setFeedback(null);
        try {
            const updated = await api.updatePaymentSettings(settings);
            setSettings(updated as PaymentSettings);
            setFeedback('تم حفظ إعدادات الدفع بنجاح.');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ إعدادات الدفع.');
        } finally {
            setLoading(false);
        }
    };

    const saveDiscountCode = async () => {
        const normalizedCode = discountForm.code.trim().toUpperCase().replace(/\s+/g, '');
        if (!normalizedCode) {
            setError('اكتب كود الخصم أولًا.');
            return;
        }

        setLoading(true);
        setError(null);
        setFeedback(null);
        try {
            const payload = {
                ...discountForm,
                code: normalizedCode,
                label: discountForm.label || normalizedCode,
                value: Number(discountForm.value) || 0,
                minAmount: Number(discountForm.minAmount) || 0,
                maxRedemptions: Number(discountForm.maxRedemptions) || 0,
            };
            const response = await api.createDiscountCode(payload);
            const saved = (response as { code?: DiscountCode }).code;
            if (saved) {
                setDiscountCodes((current) => {
                    const withoutOld = current.filter((item) => item.code !== saved.code);
                    return [{ ...saved, code: saved.code.toUpperCase() }, ...withoutOld];
                });
            }
            resetDiscountForm();
            setFeedback('تم حفظ كود الخصم وربطه بآلية الدفع.');
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'تعذر حفظ كود الخصم.');
        } finally {
            setLoading(false);
        }
    };

    const toggleDiscountStatus = async (code: DiscountCode) => {
        const nextStatus = code.status === 'active' ? 'paused' : 'active';
        setLoading(true);
        setError(null);
        setFeedback(null);
        try {
            const response = await api.updateDiscountCode(code.code, { status: nextStatus });
            const updated = (response as { code?: DiscountCode }).code;
            if (updated) {
                setDiscountCodes((current) => current.map((item) => item.code === code.code ? { ...item, ...updated } : item));
            }
            setFeedback(nextStatus === 'active' ? 'تم تفعيل كود الخصم.' : 'تم إيقاف كود الخصم مؤقتًا.');
        } catch (statusError) {
            setError(statusError instanceof Error ? statusError.message : 'تعذر تحديث حالة كود الخصم.');
        } finally {
            setLoading(false);
        }
    };

    const toggleDiscountPackage = (packageId: string) => {
        setDiscountForm((current) => {
            const currentIds = current.packageIds || [];
            return {
                ...current,
                packageIds: currentIds.includes(packageId)
                    ? currentIds.filter((id) => id !== packageId)
                    : [...currentIds, packageId],
            };
        });
    };

    const exportDiscountCodes = () => {
        downloadCsv('discount-codes.csv', [
            ['الكود', 'الاسم', 'النوع', 'القيمة', 'الحالة', 'حد أدنى', 'استخدام', 'حد الاستخدام', 'طلبات', 'إجمالي الخصم', 'باقات مرتبطة'],
            ...discountCodeRows.map((code) => [
                code.code,
                code.label || '',
                code.type === 'percentage' ? 'نسبة' : 'قيمة ثابتة',
                code.value,
                code.status,
                code.minAmount || 0,
                code.currentRedemptions || 0,
                code.maxRedemptions || 0,
                code.requests,
                code.totalDiscount,
                code.packagesLabel,
            ]),
        ]);
    };

    const reviewRequest = async (request: PaymentRequest, status: PaymentRequestStatus) => {
        setRequestActionLoading(request.id);
        setError(null);
        setFeedback(null);
        try {
            const response = await api.reviewPaymentRequest(request.id, {
                status,
                reviewerNotes: status === 'approved' ? 'تمت المراجعة والاعتماد من الإدارة.' : 'تمت مراجعة الطلب من الإدارة.',
                approvalEvidence: status === 'approved' ? buildApprovalEvidence(request) : '',
            });
            const updatedRequest = (response as { request?: PaymentRequest }).request;
            if (updatedRequest) {
                setPaymentRequests((current) => current.map((request) => (request.id === updatedRequest.id ? updatedRequest : request)));
            }
            setFeedback(status === 'approved' ? 'تم اعتماد الطلب وتفعيل الوصول على الحساب.' : 'تم تحديث حالة الطلب.');
        } catch (reviewError) {
            setError(reviewError instanceof Error ? reviewError.message : 'تعذر تحديث حالة الطلب.');
        } finally {
            setRequestActionLoading(null);
        }
    };

    const updateMethodSettings = (method: 'card' | 'transfer' | 'wallet', field: string, value: string | boolean | string[]) => {
        setSettings((current) => ({
            ...current,
            [method]: {
                ...current[method],
                [field]: value,
            },
        }));
    };

    const toggleMethodCountry = (method: 'card' | 'transfer' | 'wallet', countryCode: string) => {
        const currentCountries = settings[method].supportedCountries || [];
        updateMethodSettings(
            method,
            'supportedCountries',
            currentCountries.includes(countryCode)
                ? currentCountries.filter((country) => country !== countryCode)
                : [...currentCountries, countryCode],
        );
    };

    const applyProviderPreset = (
        method: 'card' | 'transfer' | 'wallet',
        preset: { code: string; label: string; countries: readonly string[] },
    ) => {
        setSettings((current) => ({
            ...current,
            [method]: {
                ...current[method],
                providerCode: preset.code,
                providerName: preset.label,
                supportedCountries: [...preset.countries],
                gatewayMode: method === 'transfer' ? 'manual_review' : 'payment_link',
            },
        }));
    };

    const exportSchoolPackages = () => {
        downloadCsv('school-packages-coverage.csv', [
            ['اسم الباقة', 'المدرسة', 'الحالة', 'المعلم/المدرب', 'نسبة المعلم', 'حصة المعلم التقديرية', 'النطاق', 'المسارات', 'المواد', 'المقاعد المستخدمة', 'إجمالي المقاعد', 'أكواد نشطة', 'إجمالي المحتوى', 'ملاحظات'],
            ...packageCoverageRows.map((pkg) => [
                pkg.name,
                pkg.schoolName,
                pkg.isActive ? 'نشطة' : 'موقوفة مؤقتًا',
                pkg.assignedTeacherName || 'غير محدد',
                pkg.revenueSharePercentage != null ? `${pkg.revenueSharePercentage}%` : 'غير محددة',
                pkg.teacherShare,
                pkg.scopeMode,
                pkg.pathNames.join(' | ') || 'كل المسارات حسب الإعداد',
                pkg.subjectNames.join(' | ') || 'كل المواد داخل النطاق',
                pkg.usedSeats,
                pkg.maxStudents || 0,
                pkg.activeCodes,
                pkg.totalItems,
                pkg.operationalWarnings.join(' | ') || 'لا توجد',
            ]),
        ]);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">المالية والاشتراكات</h1>
                    <p className="text-sm text-gray-500 mt-1">إدارة الإيرادات، طلبات الدفع، الباقات، وإعدادات وسائل الدفع على المنصة.</p>
                </div>
            </div>

            {(error || feedback) && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {error || feedback}
                </div>
            )}

            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
                {[
                    { id: 'overview', label: 'نظرة عامة' },
                    { id: 'requests', label: 'طلبات الدفع' },
            { id: 'settings', label: 'إعدادات الدفع' },
                    { id: 'discounts', label: 'أكواد الخصم' },
                    { id: 'b2c', label: 'اشتراكات الأفراد' },
                    { id: 'b2b', label: 'باقات المدارس' },
                    { id: 'transactions', label: 'سجل العمليات' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {kpis.map((kpi, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                        {kpi.icon}
                                    </div>
                                    <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full ${kpi.isPositive ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                                        {kpi.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        {kpi.trend}
                                    </div>
                                </div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">{kpi.label}</h3>
                                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">جاهزية البيع والدفع</h2>
                                    <p className="mt-1 text-xs text-gray-500">مؤشر سريع قبل إطلاق العروض للطلاب أو المدارس.</p>
                                </div>
                                <button
                                    onClick={exportFinancialSnapshot}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <Download size={14} />
                                    تصدير لقطة
                                </button>
                            </div>
                            <div className="mt-5">
                                <div className="flex items-end justify-between">
                                    <span className="text-4xl font-black text-indigo-700">{paymentReadinessScore}%</span>
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentReadinessWarnings.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {paymentReadinessWarnings.length === 0 ? 'جاهز للتشغيل' : 'يحتاج متابعة'}
                                    </span>
                                </div>
                                <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
                                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${paymentReadinessScore}%` }} />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900">ملاحظات تشغيلية قبل البيع</h2>
                            {paymentReadinessWarnings.length > 0 ? (
                                <div className="mt-4 grid gap-2 md:grid-cols-2">
                                    {paymentReadinessWarnings.map((warning) => (
                                        <div key={warning} className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold leading-6 text-amber-800">
                                            {warning}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                                    إعدادات الدفع والعروض الأساسية جاهزة، ويمكنك استقبال طلبات الطلاب بثقة.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">أحدث طلبات الدفع</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-600 text-sm">
                                    <tr>
                                        <th className="p-4 font-medium">رقم الطلب</th>
                                        <th className="p-4 font-medium">العميل</th>
                                        <th className="p-4 font-medium">النوع</th>
                                        <th className="p-4 font-medium">المبلغ</th>
                                        <th className="p-4 font-medium">التاريخ</th>
                                        <th className="p-4 font-medium">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recentTransactions.map((trx) => (
                                        <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-medium text-gray-900">{trx.id}</td>
                                            <td className="p-4 text-gray-800">{trx.user}</td>
                                            <td className="p-4 text-gray-600">{trx.type}</td>
                                            <td className="p-4 font-bold text-indigo-600">{trx.amount}</td>
                                            <td className="p-4 text-gray-500">{trx.date}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    trx.status === 'معتمد' || trx.status === 'نشط'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : trx.status === 'بانتظار المراجعة'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {trx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'requests' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">طلبات الدفع المرسلة من الطلاب</h2>
                            <p className="text-xs text-gray-500 mt-1">راجع الطلبات حسب الحالة وابحث بالطالب أو رقم الطلب أو مرجع الدفع قبل الاعتماد.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={exportPaymentRequests}
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <Download size={14} />
                                تصدير الطلبات
                            </button>
                            <span className="text-sm text-gray-500">{pendingRequestsCount} بانتظار المراجعة / {paymentRequests.length} إجمالي</span>
                        </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[1.3fr_2fr]">
                        <div className="relative">
                            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={requestSearchTerm}
                                onChange={(event) => setRequestSearchTerm(event.target.value)}
                                placeholder="ابحث برقم الطلب، الطالب، البريد، أو مرجع الدفع..."
                                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pr-11 pl-4 text-sm outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {([
                                ['pending', 'بانتظار المراجعة', paymentRequestStatusCounts.pending],
                                ['all', 'كل الطلبات', paymentRequestStatusCounts.all],
                                ['approved', 'معتمدة', paymentRequestStatusCounts.approved],
                                ['rejected', 'مرفوضة', paymentRequestStatusCounts.rejected],
                                ['cancelled', 'ملغية', paymentRequestStatusCounts.cancelled],
                            ] as Array<[PaymentRequestStatus | 'all', string, number]>).map(([status, label, count]) => (
                                <button
                                    key={status}
                                    onClick={() => setRequestStatusFilter(status)}
                                    className={`whitespace-nowrap rounded-2xl border px-4 py-3 text-xs font-black transition ${
                                        requestStatusFilter === status
                                            ? 'border-indigo-200 bg-indigo-600 text-white shadow-sm'
                                            : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {label}
                                    <span className={`mr-2 rounded-full px-2 py-0.5 ${requestStatusFilter === status ? 'bg-white/20 text-white' : 'bg-white text-gray-500'}`}>
                                        {count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                            <div className="text-xs font-bold text-amber-700">قيمة معلقة للمراجعة</div>
                            <div className="mt-2 text-2xl font-black text-amber-800">{settings.currency} {pendingRevenue.toLocaleString('en-US')}</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                            <div className="text-xs font-bold text-emerald-700">إيراد معتمد</div>
                            <div className="mt-2 text-2xl font-black text-emerald-800">{settings.currency} {approvedRevenue.toLocaleString('en-US')}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                            <div className="text-xs font-bold text-slate-600">النتائج المعروضة الآن</div>
                            <div className="mt-2 text-2xl font-black text-slate-900">{visiblePaymentRequests.length}</div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="p-4 font-medium">رقم الطلب</th>
                                    <th className="p-4 font-medium">الطالب</th>
                                    <th className="p-4 font-medium">العنصر</th>
                                    <th className="p-4 font-medium">الطريقة</th>
                                    <th className="p-4 font-medium">المبلغ</th>
                                    <th className="p-4 font-medium">الحالة</th>
                                    <th className="p-4 font-medium">التفاصيل</th>
                                    <th className="p-4 font-medium">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visiblePaymentRequests.map((request) => {
                                    const riskNotes = requestRiskNotes(request);
                                    const canApprove = request.status === 'pending' && riskNotes.length === 0;
                                    return (
                                    <tr key={request.id} className="hover:bg-gray-50 transition-colors align-top">
                                        <td className="p-4">
                                            <div className="font-mono text-xs font-bold text-gray-900">{request.id}</div>
                                            <div className="mt-1 text-[11px] text-gray-400">{requestDateLabel(request.createdAt)}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{request.userName || 'طالب'}</div>
                                            <div className="text-xs text-gray-500">{request.userEmail}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-gray-900">{request.itemName}</div>
                                            <div className="text-xs text-gray-500">{requestItemTypeLabel(request.itemType)}</div>
                                            {request.packageId && <div className="mt-1 font-mono text-[11px] text-gray-400">package: {request.packageId}</div>}
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            <div className="font-bold text-gray-800">{requestMethodLabel(request.paymentMethod)}</div>
                                            {riskNotes.length > 0 && (
                                                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                                                    <AlertTriangle size={12} />
                                                    يحتاج تدقيق
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-indigo-600">{request.currency} {request.amount.toLocaleString('en-US')}</div>
                                            {request.discountAmount ? (
                                                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                                                    خصم {request.discountCode}: {request.currency} {request.discountAmount.toLocaleString('en-US')}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${requestStatusClasses(request.status)}`}>
                                                {requestStatusLabel(request.status)}
                                            </span>
                                            {request.reviewedAt && (
                                                <div className="mt-1 text-[11px] text-gray-400">تمت المراجعة: {requestDateLabel(request.reviewedAt)}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500 space-y-1">
                                            {request.transferReference && <div><span className="font-bold text-gray-700">مرجع التحويل:</span> {request.transferReference}</div>}
                                            {request.walletNumber && <div><span className="font-bold text-gray-700">رقم المحفظة:</span> {request.walletNumber}</div>}
                                            {request.receiptUrl && (
                                                <a href={request.receiptUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                                                    فتح الإيصال
                                                </a>
                                            )}
                                            {request.notes && <div>{request.notes}</div>}
                                            {request.approvalEvidence && <div className="text-emerald-700">دليل الاعتماد محفوظ</div>}
                                            {request.reviewerNotes && <div className="text-gray-400">ملاحظة الإدارة: {request.reviewerNotes}</div>}
                                            {riskNotes.length > 0 && (
                                                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 font-bold leading-5 text-amber-800">
                                                    {riskNotes.join('، ')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-2 min-w-[140px]">
                                                <button
                                                    onClick={() => void reviewRequest(request, 'approved')}
                                                    disabled={requestActionLoading === request.id || !canApprove}
                                                    title={!canApprove && request.status === 'pending' ? 'يحتاج الطلب إلى مرجع أو إيصال قبل الاعتماد' : undefined}
                                                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    اعتماد
                                                </button>
                                                <button
                                                    onClick={() => void reviewRequest(request, 'rejected')}
                                                    disabled={requestActionLoading === request.id || request.status !== 'pending'}
                                                    className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    رفض
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                                {visiblePaymentRequests.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-sm text-gray-500">
                                            لا توجد طلبات مطابقة للبحث أو الفلتر الحالي.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">إعدادات وسائل الدفع</h2>
                            <button
                                onClick={() => void saveSettings()}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Save size={16} />
                                حفظ
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-bold text-gray-700">العملة</label>
                                <input
                                    value={settings.currency}
                                    onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value }))}
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <label className="rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-bold text-gray-800">مراجعة يدوية قبل التفعيل</p>
                                    <p className="text-xs text-gray-500 mt-1">إذا كانت مفعلة فلن يتم فتح الوصول إلا بعد اعتماد الإدارة.</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.manualReviewRequired}
                                    onChange={(event) => setSettings((current) => ({ ...current, manualReviewRequired: event.target.checked }))}
                                    className="h-5 w-5"
                                />
                            </label>
                        </div>

                        {([
                            ['card', 'الدفع بالبطاقة', CreditCard],
                            ['transfer', 'التحويل البنكي', Landmark],
                            ['wallet', 'المحفظة الإلكترونية', Wallet],
                        ] as const).map(([method, title, Icon]) => (
                            <div key={method} className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-white p-3 text-indigo-600 shadow-sm">
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{title}</h3>
                                            <p className="text-xs text-gray-500">يمكنك تعديل النصوص والبيانات المنشورة للطلاب.</p>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settings[method].enabled}
                                        onChange={(event) => updateMethodSettings(method, 'enabled', event.target.checked)}
                                        className="h-5 w-5"
                                    />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="text-sm font-bold text-gray-700">الاسم الظاهر</label>
                                        <input
                                            value={settings[method].label || ''}
                                            onChange={(event) => updateMethodSettings(method, 'label', event.target.value)}
                                            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700">مزود الدفع</label>
                                        <input
                                            value={settings[method].providerName || ''}
                                            onChange={(event) => updateMethodSettings(method, 'providerName', event.target.value)}
                                            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700">نمط التشغيل</label>
                                        <select
                                            value={settings[method].gatewayMode || 'manual_review'}
                                            onChange={(event) => updateMethodSettings(method, 'gatewayMode', event.target.value)}
                                            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="manual_review">مراجعة يدوية</option>
                                            <option value="payment_link">رابط دفع من المزود</option>
                                            <option value="webhook">اعتماد آلي عبر Webhook</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700">الدول المدعومة</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {paymentCountryOptions.map((country) => (
                                                <button
                                                    key={`${method}-${country.code}`}
                                                    type="button"
                                                    onClick={() => toggleMethodCountry(method, country.code)}
                                                    className={`rounded-full px-3 py-2 text-xs font-black transition-colors ${
                                                        (settings[method].supportedCountries || []).includes(country.code)
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-white text-gray-600 border border-gray-200'
                                                    }`}
                                                >
                                                    {country.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-bold text-gray-700">اختيارات جاهزة للمزود</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {paymentProviderPresets[method].map((preset) => (
                                                <button
                                                    key={`${method}-${preset.code}`}
                                                    type="button"
                                                    onClick={() => applyProviderPreset(method, preset)}
                                                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 transition-colors hover:border-indigo-200 hover:text-indigo-700"
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {method === 'transfer' && (
                                        <>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700">اسم البنك</label>
                                                <input
                                                    value={settings.transfer.bankName || ''}
                                                    onChange={(event) => updateMethodSettings('transfer', 'bankName', event.target.value)}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700">اسم المستفيد</label>
                                                <input
                                                    value={settings.transfer.accountName || ''}
                                                    onChange={(event) => updateMethodSettings('transfer', 'accountName', event.target.value)}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700">رقم الحساب</label>
                                                <input
                                                    value={settings.transfer.accountNumber || ''}
                                                    onChange={(event) => updateMethodSettings('transfer', 'accountNumber', event.target.value)}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700">الآيبان</label>
                                                <input
                                                    value={settings.transfer.iban || ''}
                                                    onChange={(event) => updateMethodSettings('transfer', 'iban', event.target.value)}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {method === 'wallet' && (
                                        <>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700">اسم المزود</label>
                                                <input
                                                    value={settings.wallet.providerName || ''}
                                                    onChange={(event) => updateMethodSettings('wallet', 'providerName', event.target.value)}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-bold text-gray-700">رقم الجوال</label>
                                                <input
                                                    value={settings.wallet.phoneNumber || ''}
                                                    onChange={(event) => updateMethodSettings('wallet', 'phoneNumber', event.target.value)}
                                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-700">تعليمات الطلب</label>
                                    <textarea
                                        value={settings[method].instructions || ''}
                                        onChange={(event) => updateMethodSettings(method, 'instructions', event.target.value)}
                                        rows={3}
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 h-fit">
                        <h2 className="text-lg font-bold text-gray-900">ملخص الدفع الحالي</h2>
                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-sm text-gray-500">طلبات معتمدة</p>
                            <p className="text-2xl font-black text-emerald-600">{settings.currency} {approvedRevenue.toLocaleString('en-US')}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-sm text-gray-500">طلبات بانتظار المراجعة</p>
                            <p className="text-2xl font-black text-amber-600">{settings.currency} {pendingRevenue.toLocaleString('en-US')}</p>
                        </div>
                        <div className="rounded-2xl bg-gray-50 p-4">
                            <p className="text-sm text-gray-500">وضع المراجعة</p>
                            <p className="text-lg font-bold text-gray-900">{settings.manualReviewRequired ? 'مراجعة يدوية مفعلة' : 'مراجعة يدوية معطلة'}</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'discounts' && (
                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">أكواد الخصم</div>
                            <div className="mt-2 text-2xl font-black text-gray-900">{discountSummary.total}</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                            <div className="text-xs font-bold text-emerald-700">نشطة الآن</div>
                            <div className="mt-2 text-2xl font-black text-emerald-800">{discountSummary.active}</div>
                        </div>
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                            <div className="text-xs font-bold text-indigo-700">طلبات استخدمت كود</div>
                            <div className="mt-2 text-2xl font-black text-indigo-800">{discountSummary.requestCount}</div>
                        </div>
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                            <div className="text-xs font-bold text-amber-700">إجمالي الخصم</div>
                            <div className="mt-2 text-2xl font-black text-amber-800">{settings.currency} {discountSummary.savedAmount.toLocaleString('en-US')}</div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">إضافة كود خصم</h2>
                                <p className="mt-1 text-xs text-gray-500">السيرفر يحسب الخصم ويمنع أي كود غير صالح قبل إنشاء طلب الدفع.</p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-600">الكود</label>
                                    <input
                                        value={discountForm.code}
                                        onChange={(event) => setDiscountForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s+/g, '') }))}
                                        placeholder="ALMEAA20"
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600">اسم داخلي</label>
                                    <input
                                        value={discountForm.label || ''}
                                        onChange={(event) => setDiscountForm((current) => ({ ...current, label: event.target.value }))}
                                        placeholder="عرض بداية التسجيل"
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600">النوع</label>
                                    <select
                                        value={discountForm.type}
                                        onChange={(event) => setDiscountForm((current) => ({ ...current, type: event.target.value as DiscountCode['type'] }))}
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="percentage">نسبة مئوية</option>
                                        <option value="fixed">قيمة ثابتة</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600">القيمة</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={discountForm.value}
                                        onChange={(event) => setDiscountForm((current) => ({ ...current, value: Number(event.target.value) }))}
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600">حد أدنى للطلب</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={discountForm.minAmount || 0}
                                        onChange={(event) => setDiscountForm((current) => ({ ...current, minAmount: Number(event.target.value) }))}
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600">حد الاستخدام</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={discountForm.maxRedemptions || 0}
                                        onChange={(event) => setDiscountForm((current) => ({ ...current, maxRedemptions: Number(event.target.value) }))}
                                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="mb-2 text-xs font-bold text-gray-600">تقييد الكود بباقات محددة</div>
                                <div className="flex max-h-44 flex-wrap gap-2 overflow-auto rounded-2xl border border-gray-100 bg-gray-50 p-3">
                                    {publicPackages.map((pkg) => {
                                        const selected = discountForm.packageIds?.includes(pkg.id);
                                        return (
                                            <button
                                                key={pkg.id}
                                                type="button"
                                                onClick={() => toggleDiscountPackage(pkg.id)}
                                                className={`rounded-full px-3 py-2 text-xs font-bold transition ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                {pkg.title}
                                            </button>
                                        );
                                    })}
                                    {publicPackages.length === 0 && <span className="text-xs text-gray-500">لا توجد باقات عامة بعد.</span>}
                                </div>
                            </div>
                            <button
                                onClick={() => void saveDiscountCode()}
                                disabled={loading}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Save size={16} />
                                حفظ كود الخصم
                            </button>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">الأكواد الحالية</h2>
                                    <p className="text-xs text-gray-500">إدارة مختصرة: تفعيل/إيقاف ومتابعة الاستخدام.</p>
                                </div>
                                <button
                                    onClick={exportDiscountCodes}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <Download size={14} />
                                    تصدير
                                </button>
                            </div>
                            <div className="grid gap-3">
                                {discountCodeRows.map((code) => (
                                    <div key={code.code} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-mono text-base font-black text-gray-900">{code.code}</span>
                                                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${code.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {code.status === 'active' ? 'نشط' : 'موقوف'}
                                                    </span>
                                                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-indigo-700">
                                                        {code.type === 'percentage' ? `${code.value}%` : `${settings.currency} ${code.value}`}
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-xs text-gray-500">{code.label || 'بدون اسم'} · {code.packagesLabel}</div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-gray-600">{code.currentRedemptions || 0}/{code.maxRedemptions || '∞'} استخدام</span>
                                                <span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-700">{settings.currency} {code.totalDiscount.toLocaleString('en-US')} خصم</span>
                                                <button
                                                    onClick={() => void toggleDiscountStatus(code)}
                                                    className={`rounded-xl px-3 py-2 text-xs font-black ${code.status === 'active' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                                                >
                                                    {code.status === 'active' ? 'إيقاف' : 'تفعيل'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {discountCodeRows.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                                        لا توجد أكواد خصم بعد.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'b2b' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">إجمالي باقات المدارس</div>
                            <div className="mt-2 text-2xl font-black text-gray-900">{schoolPackagesSummary.total}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">{schoolPackagesSummary.active} نشطة / {schoolPackagesSummary.paused} موقوفة مؤقتًا</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">الأكواد النشطة</div>
                            <div className="mt-2 text-2xl font-black text-indigo-700">{schoolPackagesSummary.activeCodes}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">صالحة للاستخدام الآن</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">استخدام المقاعد</div>
                            <div className="mt-2 text-2xl font-black text-amber-700">{schoolPackagesSummary.usedSeats}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">من أصل {schoolPackagesSummary.totalSeats || 0} مقعد</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">حصة المعلمين التقديرية</div>
                            <div className="mt-2 text-2xl font-black text-emerald-700">{settings.currency} {schoolPackagesSummary.teacherShares.toLocaleString('en-US')}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">حسب الباقات التي لها معلم ونسبة</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <h2 className="text-lg font-bold text-gray-900">المدارس والجهات المتعاقدة</h2>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => void setAllSchoolPackagesStatus('active')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                >
                                    <Unlock size={14} />
                                    تنشيط الكل
                                </button>
                                <button
                                    onClick={() => void setAllSchoolPackagesStatus('expired')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                                >
                                    <LockKeyhole size={14} />
                                    إيقاف الكل
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-600 text-sm">
                                    <tr>
                                        <th className="p-4 font-medium">الجهة</th>
                                        <th className="p-4 font-medium">الباقات</th>
                                        <th className="p-4 font-medium">الأكواد النشطة</th>
                                        <th className="p-4 font-medium">استخدام المقاعد</th>
                                        <th className="p-4 font-medium">القيمة التقديرية</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {schoolRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-medium text-gray-900">{row.name}</td>
                                            <td className="p-4 text-gray-600">{row.packages}</td>
                                            <td className="p-4 text-gray-600">{row.activeCodes}</td>
                                            <td className="p-4 text-gray-600">{row.usedSeats}/{row.totalCapacity || 0}</td>
                                            <td className="p-4 font-bold text-indigo-600">{settings.currency} {row.estimatedValue.toLocaleString('en-US')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">مراجعة تغطية الباقات والوصول</h2>
                                <p className="text-xs text-gray-500 mt-1">هذه اللوحة تساعدك تعرف الباقة تفتح أي مسارات ومواد ومحتوى قبل تسليمها لمدرسة أو مجموعة.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={exportSchoolPackages}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <Download size={14} />
                                    تصدير التغطية
                                </button>
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{packageCoverageRows.length} باقة</span>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {packageCoverageRows.map((pkg) => (
                                <div key={pkg.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-base font-black text-gray-900">{pkg.name}</h3>
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {pkg.status === 'active' ? 'نشطة' : 'موقوفة مؤقتًا'}
                                                </span>
                                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-600">{pkg.schoolName}</span>
                                                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{pkg.scopeMode}</span>
                                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-600">
                                                    {pkg.type === 'free_access' ? 'فتح وصول' : `خصم ${pkg.discountPercentage || 0}%`}
                                                </span>
                                                {pkg.assignedTeacherName && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                                        {pkg.assignedTeacherName} · {pkg.revenueSharePercentage ?? 0}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {pkg.contentTypes.map((type) => (
                                                    <span key={type} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                                                        <Eye size={12} />
                                                        {contentTypeLabel(type)}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                المسارات: {pkg.pathNames.length ? pkg.pathNames.join('، ') : 'كل المسارات حسب إعداد الباقة'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                المواد: {pkg.subjectNames.length ? pkg.subjectNames.join('، ') : 'كل المواد داخل المسار المحدد'}
                                            </div>
                                            <div className="text-xs font-bold text-gray-600">
                                                إجمالي المحتوى الذي ستفتحه الباقة الآن: {pkg.totalItems}
                                            </div>
                                            {pkg.operationalWarnings.length > 0 && (
                                                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                                                    تنبيه تشغيلي: {pkg.operationalWarnings.join('، ')}
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-[220px] rounded-2xl bg-white p-4 shadow-sm">
                                            <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-600">
                                                <span>استخدام المقاعد</span>
                                                <span>{pkg.usedSeats}/{pkg.maxStudents || 0}</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                                <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pkg.seatRate}%` }} />
                                            </div>
                                            <div className="mt-3 text-xs text-gray-500">{pkg.activeCodes} كود نشط لهذه الباقة</div>
                                            <button
                                                onClick={() => toggleSchoolPackageStatus(pkg.id, pkg.status)}
                                                className={`mt-4 w-full rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                                                    pkg.isActive
                                                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                }`}
                                            >
                                                {pkg.isActive ? 'إيقاف الباقة مؤقتًا' : 'إعادة تنشيط الباقة'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                                        {[
                                            ['دورات', pkg.counts.courses],
                                            ['تأسيس', pkg.counts.foundation],
                                            ['تدريب', pkg.counts.banks],
                                            ['اختبارات', pkg.counts.tests],
                                            ['مكتبة', pkg.counts.library],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-2xl bg-white p-3 text-center">
                                                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                                    <LockKeyhole size={14} />
                                                </div>
                                                <p className="text-xs font-bold text-gray-500">{label}</p>
                                                <p className="text-lg font-black text-gray-900">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {packageCoverageRows.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                                    لا توجد باقات مدارس بعد. عند إنشاء باقة ستظهر هنا تغطيتها ونطاق الوصول الخاص بها.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'b2c' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">إجمالي العروض العامة</div>
                            <div className="mt-2 text-2xl font-black text-gray-900">{publicPackagesSummary.total}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">{publicPackagesSummary.visible} ظاهرة / {publicPackagesSummary.hidden} مخفية</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">جاهزة للبيع</div>
                            <div className="mt-2 text-2xl font-black text-emerald-700">{publicPackagesSummary.ready}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">{publicPackagesSummary.needsSetup} تحتاج ضبط</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">طلبات معلقة</div>
                            <div className="mt-2 text-2xl font-black text-amber-700">{publicPackagesSummary.pending}</div>
                            <div className="mt-2 text-xs font-bold text-gray-500">مرتبطة بالعروض العامة فقط</div>
                        </div>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="text-xs font-bold text-gray-500">مشتركون أفراد</div>
                            <div className="mt-2 text-2xl font-black text-indigo-700">{publicPackagesSummary.buyers}</div>
                            <div className="mt-2 text-xs leading-6 font-bold text-gray-500">هذه الباقات تظهر للطالب المستقل فقط، وليست بديلًا عن باقات المدارس.</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">عروض الأفراد المعروضة على الموقع</h2>
                                <p className="text-xs text-gray-500 mt-1">هذه هي الباقات التي تظهر للطالب المستقل داخل صفحات المسارات، منفصلة تمامًا عن باقات المدارس.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={syncPublicPackagesByReadiness}
                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                >
                                    <CheckCircle size={14} />
                                    مزامنة الجاهز
                                </button>
                                <button
                                    onClick={hideAllPublicPackages}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100"
                                >
                                    <EyeOff size={14} />
                                    إخفاء الكل
                                </button>
                                <button
                                    onClick={exportPublicPackages}
                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    <Download size={14} />
                                    تصدير العروض
                                </button>
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{publicPackageRows.length} عرض</span>
                            </div>
                        </div>
                        <div className="grid gap-4">
                            {publicPackageRows.map((pkg) => (
                                <div key={pkg.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-base font-black text-gray-900">{pkg.title}</h3>
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${pkg.isVisible ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {pkg.isVisible ? 'ظاهر للطلاب' : 'مخفي'}
                                                </span>
                                                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${pkg.isReadyForSale ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-100 text-amber-800'}`}>
                                                    {pkg.isReadyForSale ? 'جاهزة للبيع' : 'تحتاج ضبط'}
                                                </span>
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{pkg.scopeMode}</span>
                                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-600">{pkg.pathName}</span>
                                                {pkg.subjectName && <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-gray-600">{pkg.subjectName}</span>}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {pkg.contentTypes.map((type) => (
                                                    <span key={type} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                                                        <Eye size={12} />
                                                        {contentTypeLabel(type)}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600 sm:grid-cols-5">
                                                {[
                                                    ['دورات', pkg.coverageCounts.courses],
                                                    ['تأسيس', pkg.coverageCounts.foundation],
                                                    ['تدريب', pkg.coverageCounts.banks],
                                                    ['اختبارات', pkg.coverageCounts.tests],
                                                    ['مكتبة', pkg.coverageCounts.library],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="rounded-xl bg-white px-3 py-2 text-center">
                                                        <span className="text-gray-400">{label}</span>
                                                        <span className="mx-1 text-gray-900">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {pkg.readinessWarnings.length > 0 && (
                                                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                                                    تنبيه قبل العرض: {pkg.readinessWarnings.join('، ')}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => previewPublicPackage(pkg.id)}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <ExternalLink size={14} />
                                                    معاينة صفحة العرض
                                                </button>
                                                <button
                                                    onClick={() => togglePublicPackageVisibility(pkg.id)}
                                                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                                                        pkg.isVisible
                                                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    }`}
                                                >
                                                    {pkg.isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {pkg.isVisible ? 'إيقاف العرض مؤقتًا' : 'إظهار للطلاب'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                                            <div className="rounded-2xl bg-white p-3 text-center">
                                                <p className="text-xs font-bold text-gray-500">السعر</p>
                                                <p className="text-lg font-black text-indigo-600">{settings.currency} {pkg.price.toLocaleString('en-US')}</p>
                                                {pkg.originalPrice > pkg.price && <p className="text-[11px] text-gray-400 line-through">{pkg.originalPrice.toLocaleString('en-US')}</p>}
                                            </div>
                                            <div className="rounded-2xl bg-white p-3 text-center">
                                                <p className="text-xs font-bold text-gray-500">طلبات معلقة</p>
                                                <p className="text-lg font-black text-amber-600">{pkg.pending}</p>
                                            </div>
                                            <div className="rounded-2xl bg-white p-3 text-center">
                                                <p className="text-xs font-bold text-gray-500">مشتركون</p>
                                                <p className="text-lg font-black text-emerald-600">{pkg.buyers}</p>
                                            </div>
                                            <div className="rounded-2xl bg-white p-3 text-center">
                                                <p className="text-xs font-bold text-gray-500">إيراد مثبت</p>
                                                <p className="text-lg font-black text-gray-900">{pkg.revenue.toLocaleString('en-US')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {publicPackageRows.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                                    لا توجد باقات عامة بعد. أنشئها من إدارة المسارات داخل تبويب الباقات الشاملة.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">طلاب الأفراد والمشتريات العامة</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-600 text-sm">
                                    <tr>
                                        <th className="p-4 font-medium">الاسم</th>
                                        <th className="p-4 font-medium">البريد</th>
                                        <th className="p-4 font-medium">الخطة</th>
                                        <th className="p-4 font-medium">الدورات</th>
                                        <th className="p-4 font-medium">الباقات العامة</th>
                                        <th className="p-4 font-medium">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {premiumRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-medium text-gray-900">{row.name}</td>
                                            <td className="p-4 text-gray-600">{row.email}</td>
                                            <td className="p-4 text-gray-600">{row.plan === 'premium' ? 'بريميوم' : 'مجاني'}</td>
                                            <td className="p-4 text-gray-600">{row.courses}</td>
                                            <td className="p-4 text-gray-600">{row.packages}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.status === 'نشط' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6">سجل العمليات</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="p-4 font-medium">رقم العملية</th>
                                    <th className="p-4 font-medium">العميل</th>
                                    <th className="p-4 font-medium">النوع</th>
                                    <th className="p-4 font-medium">القيمة</th>
                                    <th className="p-4 font-medium">التاريخ</th>
                                    <th className="p-4 font-medium">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentTransactions.map((trx) => (
                                    <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-medium text-gray-900">{trx.id}</td>
                                        <td className="p-4 text-gray-800">{trx.user}</td>
                                        <td className="p-4 text-gray-600">{trx.type}</td>
                                        <td className="p-4 font-bold text-indigo-600">{trx.amount}</td>
                                        <td className="p-4 text-gray-500">{trx.date}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                trx.status === 'معتمد' || trx.status === 'نشط'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : trx.status === 'بانتظار المراجعة'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-red-100 text-red-700'
                                            }`}>
                                                {trx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
