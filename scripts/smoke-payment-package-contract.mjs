import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const paymentModalSource = read('components/PaymentModal.tsx');
const learningSectionSource = read('components/LearningSection.tsx');
const pathPageSource = read('pages/GenericPathPage.tsx');
const paymentModelSource = read('server/src/models/PaymentRequest.ts');
const paymentRoutesSource = read('server/src/routes/payment.routes.ts');
const courseModelSource = read('server/src/models/Course.ts');
const courseRoutesSource = read('server/src/routes/course.routes.ts');
const typesSource = read('types.ts');
const pathsManagerSource = read('dashboards/admin/PathsManager.tsx');
const financialManagerSource = read('dashboards/admin/FinancialManager.tsx');
const apiSource = read('services/api.ts');
const discountModelSource = read('server/src/models/DiscountCode.ts');
const backupSource = read('server/src/services/learningBackup.ts');

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const assertIncludes = (source, snippet, message = snippet) => {
  if (!source.includes(snippet)) {
    throw new Error(`Missing: ${message}`);
  }
};

check('payment requests preserve discount data and calculate final amount server-side', () => {
  assertIncludes(typesSource, 'discountCode?: string;');
  assertIncludes(typesSource, 'discountAmount?: number;');
  assertIncludes(paymentModelSource, 'discountCode: { type: String, default: "" }');
  assertIncludes(paymentModelSource, 'discountAmount: { type: Number, default: 0 }');
  assertIncludes(paymentRoutesSource, 'discountCode: z.string().max(80).optional()');
  assertIncludes(paymentRoutesSource, 'normalizeDiscountCode(payload.discountCode)');
  assertIncludes(paymentRoutesSource, 'calculateDiscountAmount');
  assertIncludes(paymentRoutesSource, 'amount: finalAmount');
  assertIncludes(paymentRoutesSource, '"/discount-codes/preview"');
  assertIncludes(paymentRoutesSource, 'لا يمكن اعتماد طلب دفع لمستخدم غير موجود');
  assertIncludes(paymentRoutesSource, 'كود الخصم لم يعد متاحًا للاعتماد');
  assertIncludes(paymentRoutesSource, 'PaymentRequestModel.findOneAndUpdate');
  assertIncludes(paymentRoutesSource, 'grantApprovedPaymentAccess');
  assertIncludes(paymentModalSource, 'discountCode: discountCode.trim().toUpperCase()');
  assertIncludes(paymentModalSource, 'api.previewDiscountCode');
  assertIncludes(apiSource, 'previewDiscountCode');
});

check('discount approval is guarded before access is granted', () => {
  const redemptionIndex = paymentRoutesSource.indexOf('const redemption = await DiscountCodeModel.findOneAndUpdate');
  const grantIndex = paymentRoutesSource.indexOf('grantApprovedPaymentAccess', redemptionIndex);
  if (redemptionIndex === -1 || grantIndex === -1 || redemptionIndex > grantIndex) {
    throw new Error('Discount redemption must be reserved before granting access.');
  }
  assertIncludes(paymentRoutesSource, 'status: "pending"');
  assertIncludes(paymentRoutesSource, 'تعذر اعتماد كود الخصم أثناء المراجعة');
});

check('manual payment approval requires review evidence before unlocking access', () => {
  assertIncludes(typesSource, 'approvalEvidence?: string;');
  assertIncludes(paymentModelSource, 'approvalEvidence: { type: String, default: "" }');
  assertIncludes(paymentRoutesSource, 'hasManualPaymentEvidence(payload)');
  assertIncludes(paymentRoutesSource, 'hasManualPaymentEvidence(requestDoc, payload.approvalEvidence)');
  assertIncludes(paymentRoutesSource, 'buildPaymentEvidenceSummary(requestDoc, payload.approvalEvidence)');
  assertIncludes(financialManagerSource, 'buildApprovalEvidence(request)');
  assertIncludes(financialManagerSource, "const canApprove = request.status === 'pending' && riskNotes.length === 0;");
});

check('verified payment webhook can approve requests without trusting the browser', () => {
  assertIncludes(typesSource, 'webhookEnabled?: boolean;');
  assertIncludes(typesSource, 'gatewayEventId?: string;');
  assertIncludes(paymentModelSource, 'gatewayEventId: { type: String, default: "" }');
  assertIncludes(paymentModelSource, 'gatewayTransactionId: { type: String, default: "" }');
  assertIncludes(paymentRoutesSource, 'paymentWebhookSchema');
  assertIncludes(paymentRoutesSource, '"/webhooks/payment"');
  assertIncludes(paymentRoutesSource, 'x-payment-signature');
  assertIncludes(paymentRoutesSource, 'crypto.timingSafeEqual');
  assertIncludes(paymentRoutesSource, 'PAYMENT_WEBHOOK_SECRET');
  assertIncludes(paymentRoutesSource, 'requestDoc.gatewayEventId === payload.eventId');
  assertIncludes(paymentRoutesSource, 'duplicateGatewayEvent');
  assertIncludes(paymentRoutesSource, 'Payment gateway event was already used');
  assertIncludes(paymentRoutesSource, 'Payment request is not pending');
  assertIncludes(paymentRoutesSource, 'Payment currency mismatch');
  assertIncludes(paymentRoutesSource, 'Paid amount is lower than request amount');
  assertIncludes(paymentRoutesSource, 'reviewedBy: `webhook:${payload.provider}`');
  assertIncludes(paymentRoutesSource, 'payment.webhook.approved');
});

check('discount codes are admin-managed and included in backups', () => {
  assertIncludes(discountModelSource, 'DiscountCodeModel');
  assertIncludes(paymentRoutesSource, '"/discount-codes"');
  assertIncludes(paymentRoutesSource, 'currentRedemptions');
  assertIncludes(paymentRoutesSource, 'payment.discount-code.upsert');
  assertIncludes(financialManagerSource, "label: 'أكواد الخصم'");
  assertIncludes(financialManagerSource, 'saveDiscountCode');
  assertIncludes(apiSource, 'getDiscountCodes');
  assertIncludes(apiSource, 'createDiscountCode');
  assertIncludes(apiSource, 'updateDiscountCode');
  assertIncludes(backupSource, 'discountCodes');
});

check('locked learning sections can offer multiple matching public packages', () => {
  assertIncludes(learningSectionSource, 'getPublicPackagesForScope');
  assertIncludes(learningSectionSource, 'publicPackageOptions.slice(0, 8).map');
  assertIncludes(learningSectionSource, 'packageOptions: matchedPackage');
  assertIncludes(paymentModalSource, 'packageOptions.length > 1');
  assertIncludes(paymentModalSource, 'const hasPackageChoices = packageOptions.length > 1;');
  assertIncludes(paymentModalSource, "hasPackageChoices && (step === 'intro' || step === 'method') ? 'max-w-4xl' : 'max-w-xl'");
  assertIncludes(paymentModalSource, "useState<'intro' | 'method' | 'details' | 'success'>('intro')");
  assertIncludes(paymentModalSource, 'عرض طرق الدفع والتفعيل');
  assertIncludes(paymentModalSource, 'هذا الجزء يحتاج باقة');
  assertIncludes(paymentModalSource, 'sm:grid-cols-2 lg:grid-cols-3');
  assertIncludes(paymentModalSource, 'min-h-[108px]');
});

check('path package tab includes global memberships without path binding', () => {
  assertIncludes(pathPageSource, 'const packagePathId = c.pathId || c.category;');
  assertIncludes(pathPageSource, 'return !packagePathId || packagePathId === path.id;');
  assertIncludes(pathPageSource, 'const getPackageKindLabel = (contentTypes: string[])');
  assertIncludes(pathPageSource, 'const getPackageTone = (contentTypes: string[])');
  assertIncludes(pathPageSource, 'getPackageKindLabel(contentTypes)');
  assertIncludes(pathPageSource, 'motion-safe:animate-pulse');
  assertIncludes(pathPageSource, '${tone.header} text-white');
  assertIncludes(pathPageSource, '${tone.action} shadow-lg');
});

check('admin can create global memberships that unlock the whole platform', () => {
  assertIncludes(typesSource, "'membership'");
  assertIncludes(courseModelSource, '"membership"');
  assertIncludes(courseRoutesSource, '"membership"');
  assertIncludes(pathsManagerSource, 'setPackageAppliesGlobally');
  assertIncludes(pathsManagerSource, "packageType: packageAppliesGlobally ? 'membership' : 'courses'");
  assertIncludes(pathsManagerSource, "packageContentTypes: packageAppliesGlobally ? ['all'] : normalizedContentTypes");
  assertIncludes(pathsManagerSource, 'const isGlobalMembership = !packagePathId');
  assertIncludes(pathsManagerSource, 'عضوية عامة تفتح كل المنصة');
});

let failed = 0;
for (const item of checks) {
  try {
    item.fn();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error.message);
  }
}

if (failed) {
  console.error(`\n${failed}/${checks.length} payment/package contract checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} payment/package contract smoke checks passed.`);
