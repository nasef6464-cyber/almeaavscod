import React from "react";

const plans = [
  { name: "基础", price: "0", period: "永久免费", features: ["10个测验", "基础统计", "社区支持"] },
  { name: "专业版", price: "49", period: "每月", features: ["无限测验", "详细分析", "AI推荐", "优先支持"] },
  { name: "企业版", price: "199", period: "每月", features: ["全部专业版功能", "自定义品牌", "API访问", "专属客户经理"] },
];

export const Pricing: React.FC = () => {
  const [billing, setBilling] = React.useState<"monthly" | "annual">("monthly");

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">اختر خطتك المناسبة</h1>
        <p className="mt-4 text-lg text-gray-600">ابدأ مجاناً وطور تعلمك مع منصة المئة</p>
      </div>
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
            <p className="mt-4">
              <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
              <span className="text-gray-500"> / {plan.period}</span>
            </p>
            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button className="mt-8 w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700">
              {plan.name === "基础" ? "ابدأ مجاناً" : "اشتراك الآن"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
