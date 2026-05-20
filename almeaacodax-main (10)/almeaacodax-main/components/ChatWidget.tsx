import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { getChatResponse } from '../services/geminiService';
import { Link } from 'react-router-dom';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    personalized?: boolean;
    weaknessesCount?: number;
    provider?: string;
    model?: string;
    usedFallback?: boolean;
}

const quickPrompts = [
    'أنا ضعيف في إيه وابدأ أذاكر منين؟',
    'اعمل لي خطة مذاكرة اليوم',
    'اشرح لي فكرة الكسور ببساطة',
    'إزاي أراجع أخطائي بعد الاختبار؟',
];

const providerLabels: Record<string, string> = {
    gemini: 'Gemini',
    openrouter: 'OpenRouter',
    deepseek: 'DeepSeek',
    qwen: 'Qwen',
    openai: 'OpenAI',
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
    none: 'احتياطي',
};

export const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'مرحبًا! أنا مساعدك الذكي في منصة المئة. اكتب المهارة أو السؤال، وسأقترح لك شرحًا وخطوة تدريب مناسبة.',
            sender: 'bot',
            provider: 'none',
            usedFallback: true,
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (override?: string) => {
        const text = (override || inputValue).trim();
        if (!text) return;

        const userMsg: Message = { id: Date.now().toString(), text, sender: 'user' };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        const responseText = await getChatResponse(userMsg.text);

        const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            text: responseText.text,
            sender: 'bot',
            personalized: responseText.personalized,
            weaknessesCount: responseText.weaknessesCount,
            provider: responseText.provider,
            model: responseText.model,
            usedFallback: responseText.usedFallback,
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-20 md:bottom-8 left-4 md:left-8 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-all z-50 flex items-center justify-center"
                aria-label="فتح المساعد الذكي"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {isOpen && (
                <div className="fixed bottom-36 md:bottom-24 left-4 md:left-8 w-[90vw] md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 flex flex-col max-h-[60vh] md:max-h-[500px]">
                    <div className="bg-primary-600 p-4 text-white flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <MessageCircle size={20} />
                            <h3 className="font-bold">المساعد الذكي</h3>
                        </div>
                        <span className="text-[11px] bg-white/15 px-2 py-1 rounded-full">مرشد الطالب</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${
                                        msg.sender === 'user'
                                            ? 'bg-primary-100 text-primary-900 rounded-bl-none'
                                            : 'bg-white border border-gray-200 text-gray-800 rounded-br-none'
                                    }`}
                                >
                                    {msg.personalized && (
                                        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                            <Sparkles size={12} />
                                            مبني على أدائك{msg.weaknessesCount ? `: ${msg.weaknessesCount} مهارات` : ''}
                                        </div>
                                    )}
                                    <div className="whitespace-pre-line">{msg.text}</div>
                                    {msg.sender === 'bot' && msg.personalized ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Link
                                                to="/reports"
                                                onClick={() => setIsOpen(false)}
                                                className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"
                                            >
                                                افتح تقريري
                                            </Link>
                                            <Link
                                                to="/plan"
                                                onClick={() => setIsOpen(false)}
                                                className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"
                                            >
                                                خطتي الدراسية
                                            </Link>
                                        </div>
                                    ) : null}
                                    {msg.sender === 'bot' && msg.provider ? (
                                        <div className="mt-2 text-[10px] font-bold text-gray-400">
                                            {msg.usedFallback ? 'رد آمن احتياطي' : `مزود: ${providerLabels[msg.provider] || msg.provider}`}
                                            {msg.model && !msg.usedFallback ? ` · ${msg.model}` : ''}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 p-3 rounded-xl rounded-br-none flex items-center gap-2 text-gray-500 text-sm">
                                    <Loader2 size={16} className="animate-spin" />
                                    جاري التفكير...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 bg-white border-t border-gray-100 space-y-3">
                        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold leading-5 text-emerald-800">
                            اسألني عن نقطة ضعفك، خطة يومية، شرح قانون، أو كيف تراجع أخطاء الاختبار.
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {quickPrompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => void handleSend(prompt)}
                                    disabled={isLoading}
                                    className="shrink-0 rounded-full bg-gray-50 border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-primary-300 hover:text-primary-700 disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                                placeholder="اكتب سؤالك هنا..."
                                className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => void handleSend()}
                                disabled={isLoading || !inputValue.trim()}
                                className="bg-primary-600 text-white p-2 rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="إرسال السؤال"
                            >
                                <Send size={18} className={document.dir === 'rtl' ? 'rotate-180' : ''} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
