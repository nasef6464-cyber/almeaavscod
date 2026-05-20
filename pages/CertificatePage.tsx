import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";

const CertificatePage: React.FC = () => {
  const { code = "" } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [certificate, setCertificate] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.getCertificateByCode(code);
        if (mounted) setCertificate(data);
      } catch {
        if (mounted) setError("تعذر تحميل الشهادة.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (code) void run();
    return () => {
      mounted = false;
    };
  }, [code]);

  const verifyUrl = useMemo(() => `${window.location.origin}/certificate/${code}`, [code]);

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (error || !certificate) return <div className="p-8 text-center text-red-600">{error || "الشهادة غير موجودة"}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-3xl font-black">شهادة إتمام</h1>
        <p className="mb-2">الطالب: <strong>{certificate.studentName}</strong></p>
        <p className="mb-2">الدورة: <strong>{certificate.courseName}</strong></p>
        <p className="mb-2">نسبة الإتمام: <strong>{certificate.completionPercentage}%</strong></p>
        <p className="mb-6">رمز التحقق: <code>{certificate.verificationCode}</code></p>
        <img
          alt="QR verification"
          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(verifyUrl)}`}
          className="mb-6 rounded-xl border"
        />
        <button onClick={() => window.print()} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white">
          طباعة / حفظ PDF
        </button>
      </div>
    </div>
  );
};

export default CertificatePage;

