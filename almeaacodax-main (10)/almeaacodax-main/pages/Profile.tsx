
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, User, Mail, Phone, CreditCard, School, ChevronDown, ChevronUp, Eye, EyeOff, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useStore } from '../store/useStore';

const Profile: React.FC = () => {
    const user = useStore((state) => state.user);
    const fullNameParts = (user?.name || '').trim().split(' ').filter(Boolean);
    const firstName = fullNameParts[0] || '';
    const lastName = fullNameParts.slice(1).join(' ') || '';

    // State for Profile Image
    const [avatar, setAvatar] = useState(user?.avatar || 'https://i.pravatar.cc/150?u=profile-fallback');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for Form Fields matched to screenshot
    const [formData, setFormData] = useState({
        firstName,
        lastName,
        email: user?.email || '',
        phone: (user as any)?.phone || '',
        idNumber: '',
        academicStage: (user as any)?.academicStage || 'high_school',
        classNumber: (user as any)?.classNumber || 'grade_1',
        schoolName: (user as any)?.schoolName || '',
    });

    // State for UI interactions
    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    
    // Animation state for progress bar
    const [animatedCompletionRate, setAnimatedCompletionRate] = useState(0);

    // Profile Completion Calculation
    const filledFields = Object.values(formData).filter(v => v !== '').length;
    const totalFields = Object.keys(formData).length;
    const completionRate = Math.round((filledFields / totalFields) * 100);

    // Trigger animation on mount or update
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedCompletionRate(completionRate);
        }, 100);
        return () => clearTimeout(timer);
    }, [completionRate]);

    useEffect(() => {
        setAvatar(user?.avatar || 'https://i.pravatar.cc/150?u=profile-fallback');
        setFormData({
            firstName,
            lastName,
            email: user?.email || '',
            phone: (user as any)?.phone || '',
            idNumber: '',
            academicStage: (user as any)?.academicStage || 'high_school',
            classNumber: (user as any)?.classNumber || 'grade_1',
            schoolName: (user as any)?.schoolName || '',
        });
    }, [firstName, lastName, user]);

    // Handlers
    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Create local preview URL
            const imageUrl = URL.createObjectURL(file);
            setAvatar(imageUrl);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API Call
        setTimeout(() => {
            setIsSaving(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }, 1500);
    };

    return (
        <div className="max-w-3xl mx-auto pb-20 space-y-6">
            {/* Header & Completion Widget (Improvement) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">الملف الشخصي</h1>
                    <p className="text-gray-500 text-sm">إدارة بياناتك الشخصية والأكاديمية</p>
                </div>
                
                {/* Improvement: Profile Completion Widget */}
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="transform -rotate-90 w-10 h-10">
                            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-gray-100" />
                            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="transparent" 
                                className={`${completionRate === 100 ? 'text-emerald-500' : 'text-secondary-500'} transition-all duration-1000 ease-out`}
                                strokeDasharray={100}
                                strokeDashoffset={100 - animatedCompletionRate}
                            />
                        </svg>
                        <span className="absolute text-[10px] font-bold">{completionRate}%</span>
                    </div>
                    <div className="text-xs">
                        <div className="font-bold text-gray-700">اكتمال الملف</div>
                        <div className="text-gray-400">{completionRate === 100 ? 'مكتمل تماماً' : 'أكمل بياناتك لمزيد من المزايا'}</div>
                    </div>
                </div>
            </div>

            {/* Avatar Section (Requested Feature) */}
            <Card className="p-6 flex flex-col items-center relative overflow-hidden border-t-4 border-t-secondary-500">
                <div className="relative group cursor-pointer" onClick={handleImageClick}>
                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-gray-100">
                        <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                        
                        {/* Overlay on Hover (Improvement) */}
                        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px]">
                            <Camera className="text-white mb-1" size={24} />
                            <span className="text-white text-xs font-bold">تغيير الصورة</span>
                        </div>
                    </div>
                    
                    {/* Quick Action Button */}
                    <button className="absolute bottom-0 right-0 bg-white text-gray-700 p-2 rounded-full shadow-md border border-gray-100 hover:bg-gray-50">
                        <Upload size={16} />
                    </button>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>
                
                <h2 className="mt-4 text-xl font-bold text-gray-800">{formData.firstName} {formData.lastName}</h2>
                <p className="text-gray-500 text-sm">طالب متميز</p>
            </Card>

            {/* Main Form matching Screenshot */}
            <Card className="p-5 sm:p-6 md:p-8 border-t-4 border-t-secondary-500">
                <div className="space-y-8">
                    
                    {/* Personal Data Section */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
                            البيانات الشخصية
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Right Column (RTL) */}
                            <InputField 
                                label="الاسم الأول" 
                                name="firstName" 
                                value={formData.firstName} 
                                onChange={handleInputChange} 
                                required 
                            />
                            {/* Left Column */}
                            <InputField 
                                label="الاسم الأخير" 
                                name="lastName" 
                                value={formData.lastName} 
                                onChange={handleInputChange} 
                                required 
                            />
                            
                            <InputField 
                                label="رقم الهاتف" 
                                name="phone" 
                                value={formData.phone} 
                                onChange={handleInputChange} 
                                required 
                                dir="rtl"
                                placeholder="أدخل رقم الهاتف"
                            />
                            <InputField 
                                label="البريد الإلكتروني" 
                                name="email" 
                                value={formData.email} 
                                onChange={handleInputChange} 
                                required 
                                dir="ltr"
                            />
                            
                            <div className="md:col-span-2">
                                <InputField 
                                    label="رقم الهوية" 
                                    name="idNumber" 
                                    value={formData.idNumber} 
                                    onChange={handleInputChange} 
                                    placeholder="رقم الهوية"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Academic Data Section */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100 flex items-center gap-2">
                            البيانات الأكاديمية
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">المرحلة الدراسية</label>
                                <div className="relative">
                                    <select 
                                        name="academicStage"
                                        value={formData.academicStage}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-700 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none transition-all bg-white appearance-none"
                                    >
                                        <option value="high_school">المرحلة الثانوية</option>
                                        <option value="middle_school">المرحلة المتوسطة</option>
                                        <option value="university">المرحلة الجامعية</option>
                                    </select>
                                    <ChevronDown className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الفصل</label>
                                <div className="relative">
                                    <select 
                                        name="classNumber"
                                        value={formData.classNumber}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-700 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none transition-all bg-white appearance-none"
                                    >
                                        <option value="grade_1">الصف الأول</option>
                                        <option value="grade_2">الصف الثاني</option>
                                        <option value="grade_3">الصف الثالث</option>
                                    </select>
                                    <ChevronDown className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <InputField 
                                    label="اسم المدرسة" 
                                    name="schoolName" 
                                    value={formData.schoolName} 
                                    onChange={handleInputChange}
                                    placeholder="اسم المدرسة"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Password Section (Improvement: Collapsible) */}
                    <div className="border-t border-gray-100 pt-4">
                        <button 
                            onClick={() => setIsPasswordOpen(!isPasswordOpen)}
                            className="flex items-center gap-2 text-gray-800 font-bold hover:text-secondary-600 transition-colors"
                        >
                            {isPasswordOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            تغيير كلمة المرور
                        </button>
                        
                        {isPasswordOpen && (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in bg-gray-50 p-5 sm:p-6 rounded-xl">
                                <PasswordInput label="كلمة المرور الحالية" show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                                <PasswordInput label="كلمة المرور الجديدة" show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                                <div className="md:col-span-2 flex items-center gap-2 text-xs text-gray-500">
                                    <AlertCircle size={16} className="text-blue-500" />
                                    يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل وحرف كبير ورقم.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-[#8b9df8] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#7a8ce6] transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-70 min-w-[160px] w-full sm:w-auto"
                        >
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : saveSuccess ? (
                                <>
                                    <CheckCircle size={20} />
                                    تم الحفظ
                                </>
                            ) : (
                                'حفظ التغييرات'
                            )}
                        </button>
                        <button className="px-8 py-3 rounded-lg border border-gray-300 font-bold text-gray-500 hover:bg-gray-50 transition-colors w-full sm:w-auto">
                            إلغاء
                        </button>
                    </div>

                </div>
            </Card>
        </div>
    );
};

// Helper Components

const InputField = ({ label, name, value, onChange, type = "text", required = false, dir, placeholder }: any) => (
    <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input 
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            dir={dir}
            placeholder={placeholder}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-700 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none transition-all placeholder-gray-300"
        />
    </div>
);

const PasswordInput = ({ label, show, onToggle }: any) => (
    <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
        <div className="relative">
            <input 
                type={show ? "text" : "password"}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-700 focus:border-secondary-500 focus:ring-1 focus:ring-secondary-500 outline-none transition-all bg-white"
                placeholder="••••••••"
            />
            <button 
                type="button"
                onClick={onToggle}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    </div>
);

export default Profile;
