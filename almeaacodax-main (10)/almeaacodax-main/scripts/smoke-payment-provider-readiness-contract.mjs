import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const types = read('types.ts');
const modal = read('components/PaymentModal.tsx');
const manager = read('dashboards/admin/FinancialManager.tsx');
const settingsModel = read('server/src/models/PaymentSettings.ts');
const requestModel = read('server/src/models/PaymentRequest.ts');
const routes = read('server/src/routes/payment.routes.ts');
const report = read('PAYMENT_PROVIDER_READINESS_REPORT.md');

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const includes = (source, snippet) => {
  if (!source.includes(snippet)) throw new Error(`Missing: ${snippet}`);
};

check('payment method settings include provider, country, and gateway metadata', () => {
  includes(types, 'providerCode?: string;');
  includes(types, "gatewayMode?: 'manual_review' | 'payment_link' | 'webhook';");
  includes(types, 'supportedCountries?: string[];');
  includes(settingsModel, 'providerCode: { type: String');
  includes(settingsModel, 'gatewayMode: { type: String');
  includes(settingsModel, 'supportedCountries: { type: [String]');
});

check('payment requests persist provider metadata for audit and later gateway reconciliation', () => {
  includes(types, 'paymentProviderCode?: string;');
  includes(types, 'paymentGatewayMode?: string;');
  includes(types, 'paymentCountry?: string;');
  includes(requestModel, 'paymentProviderCode: { type: String');
  includes(requestModel, 'paymentGatewayMode: { type: String');
  includes(requestModel, 'paymentCountry: { type: String');
  includes(requestModel, 'paymentRequestSchema.index({ paymentProviderCode: 1');
});

check('backend validates supported countries and exposes safe public provider settings', () => {
  includes(routes, 'providerCode: z.string().max(80).optional()');
  includes(routes, 'gatewayMode: z.enum(["manual_review", "payment_link", "webhook"]).optional()');
  includes(routes, 'supportedCountries: z.array(z.string().max(3)).optional()');
  includes(routes, 'وسيلة الدفع غير متاحة لهذه الدولة حاليًا');
  includes(routes, 'paymentProviderCode: payload.paymentProviderCode || selectedMethodSettings.providerCode || ""');
});

check('admin can choose Egypt and Saudi provider presets without redesigning the finance screen', () => {
  includes(manager, 'Tap Payments');
  includes(manager, 'MyFatoorah');
  includes(manager, 'HyperPay');
  includes(manager, 'Paymob');
  includes(manager, 'Fawry');
  includes(manager, 'Vodafone Cash');
  includes(manager, 'paymentCountryOptions');
  includes(manager, 'applyProviderPreset');
});

check('student payment modal displays provider context and sends provider metadata', () => {
  includes(modal, 'methodProviderLabel');
  includes(modal, 'مزود الدفع');
  includes(modal, 'paymentProviderCode: method ? settings[method]?.providerCode');
  includes(modal, 'paymentGatewayMode: method ? settings[method]?.gatewayMode');
  includes(modal, 'paymentCountry: method ? (settings[method]?.supportedCountries');
});

check('handover report documents external credentials and no live gateway claim', () => {
  includes(report, 'لا توجد مفاتيح إنتاجية داخل الكود');
  includes(report, 'PAYMENT_WEBHOOK_SECRET');
  includes(report, 'Tap');
  includes(report, 'Paymob');
  includes(report, 'Fawry');
});

check('student payment modal explains purchase separation and safe manual review', () => {
  includes(modal, 'purchaseSeparationLabel');
  includes(modal, 'packageCourseSeparationNote');
  includes(modal, 'paymentDecisionRows');
  includes(modal, 'renderPaymentDecisionSummary');
  includes(modal, 'ملخص طلب الشراء');
  includes(modal, 'لن يتم فتح المحتوى تلقائيًا من المتصفح');
  includes(modal, 'هذا الطلب يفتح الباقة المختارة فقط');
  includes(modal, 'هذا الطلب يفتح هذا العنصر فقط');
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
  console.error(`\n${failed}/${checks.length} payment provider readiness checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} payment provider readiness checks passed.`);
