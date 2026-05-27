import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  userAnswer?: number;
}

export const ReviewSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(`review_${sessionId}`);
    if (stored) {
      try { setQuestions(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [sessionId]);

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">مراجعة الإجابات</h1>
        <p className="mt-4 text-gray-600">لا توجد أسئلة للمراجعة في هذه الجلسة.</p>
        <button onClick={() => navigate("/dashboard")} className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700">العودة للوحة التحكم</button>
      </div>
    );
  }

  const q = questions[currentIndex];
  const isCorrect = q.userAnswer === q.correctIndex;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">مراجعة الإجابات</h1>
        <span className="text-sm text-gray-500">{currentIndex + 1} / {questions.length}</span>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-lg font-medium text-gray-900">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            let cls = "rounded-xl border p-3 text-sm ";
            if (i === q.correctIndex) cls += " border-green-400 bg-green-50 text-green-800";
            else if (i === q.userAnswer && i !== q.correctIndex) cls += " border-red-400 bg-red-50 text-red-800";
            else cls += " border-gray-200 text-gray-700";
            return <div key={i} className={cls}>{opt}</div>;
          })}
        </div>
        <div className={`mt-4 rounded-xl p-3 text-sm ${isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {isCorrect ? "✓ إجابة صحيحة" : "✗ إجابة خاطئة"}
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <button onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0} className="rounded-xl bg-gray-100 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50">السابق</button>
        <button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={currentIndex === questions.length - 1} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">التالي</button>
      </div>
    </div>
  );
};
