import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg md:left-auto md:right-4 md:w-80">
      <p className="mb-3 text-sm font-medium text-gray-900">حمّل تطبيق منصة المئة</p>
      <div className="flex gap-2">
        <button onClick={handleInstall} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">تثبيت</button>
        <button onClick={() => setShowBanner(false)} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200">لاحقاً</button>
      </div>
    </div>
  );
};
