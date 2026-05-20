import React, { useMemo } from 'react';
import { Clock, TrendingUp, AlertTriangle, Zap, FileText, PieChart, Heart, Map as MapIcon, HelpCircle, Star } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Link } from 'react-router-dom';
import { SmartLearningPath } from '../components/SmartLearningPath';
import { useStore } from '../store/useStore';
import { QuizResult, SkillGap } from '../types';
import { sanitizeArabicText } from '../utils/sanitizeMojibakeArabic';

const displayText = (value?: string | null) => sanitizeArabicText(value) || '';
const DASH = '-';

const buildSmartPathSkillsFromResults = (examResults: QuizResult[]): SkillGap[] => {
  if (!examResults || examResults.length === 0) return [];

  const skillMap = new globalThis.Map<string, { skill: string; masterySum: number; attempts: number }>();

  examResults.forEach((result) => {
    result.skillsAnalysis?.forEach((skill) => {
      const key = skill.skillId || skill.skill;
      const existing = skillMap.get(key);
      if (existing) {
        existing.masterySum += skill.mastery;
        existing.attempts += 1;
        return;
      }
      skillMap.set(key, { skill: skill.skill, masterySum: skill.mastery, attempts: 1 });
    });
  });

  return Array.from(skillMap.values())
    .map((item): SkillGap => {
      const mastery = Math.round(item.masterySum / item.attempts);
      return {
        skill: item.skill,
        mastery,
        status: mastery < 50 ? 'weak' : mastery < 75 ? 'average' : 'strong',
      };
    })
    .sort((a, b) => a.mastery - b.mastery);
};

const Home: React.FC = () => {
  const { user, courses, enrolledCourses, completedLessons, examResults, recentActivity, hasScopedPackageAccess } = useStore();

  const smartSkills = useMemo(() => buildSmartPathSkillsFromResults(examResults), [examResults]);

  const accessibleCourseIds = useMemo(
    () =>
      new Set(
        courses
          .filter(
            (course) =>
              enrolledCourses.includes(course.id) ||
              (user.subscription?.purchasedCourses || []).includes(course.id) ||
              hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject),
          )
          .map((course) => course.id),
      ),
    [courses, enrolledCourses, hasScopedPackageAccess, user.subscription?.purchasedCourses],
  );

  const activeCourses = useMemo(() => {
    const visibleCourses = courses.filter((course) => !course.isPackage);
    const enrolled = visibleCourses.filter((course) => accessibleCourseIds.has(course.id));
    return enrolled.length > 0 ? enrolled : visibleCourses.slice(0, 4);
  }, [accessibleCourseIds, courses]);

  const scheduleItems = useMemo(() => {
    const pendingLessons = activeCourses
      .flatMap((course) =>
        (course.modules || []).flatMap((mod) =>
          mod.lessons.map((lesson) => ({
            id: `${course.id}_${lesson.id}`,
            subject: `${displayText(course.title)} - ${displayText(lesson.title)}`,
            duration: lesson.duration || DASH,
          }))
        )
      )
      .filter((lesson) => !completedLessons.includes(lesson.id.split('_')[1]))
      .slice(0, 3)
      .map((lesson, index) => ({
        ...lesson,
        day: index === 0 ? 'اليوم' : 'هذا الأسبوع',
        status: index === 0 ? 'in-progress' : 'upcoming',
      }));

    if (pendingLessons.length > 0) return pendingLessons;

    return recentActivity.slice(0, 3).map((item) => ({
      id: item.id,
      subject: displayText(item.title),
      day: new Date(item.date).toLocaleDateString('ar-SA'),
      duration: DASH,
      status: 'completed' as const,
    }));
  }, [activeCourses, completedLessons, recentActivity]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">مرحبًا، {displayText(user.name).split(' ')[0]}</h2>
          <p className="text-gray-500">لنواصل رحلة التعلم اليوم</p>
        </div>
        <Link to="/gamification" className="w-full sm:w-auto bg-secondary-100 text-secondary-600 px-4 py-2 rounded-full text-sm font-bold flex items-center justify-center gap-2">
          <TrendingUp size={16} />
          المستوى 12
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Link to="/quiz" className="min-h-[130px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <Zap size={24} />
              </div>
              <span className="font-bold text-gray-800 text-sm">الاختبارات المحاكية</span>
            </Link>

            <Link to="/dashboard?tab=quizzes" className="min-h-[130px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <FileText size={24} />
              </div>
              <span className="font-bold text-gray-800 text-sm">اختباراتي</span>
            </Link>

            <Link to="/reports" className="min-h-[130px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <PieChart size={24} />
              </div>
              <span className="font-bold text-gray-800 text-sm">تقاريري</span>
            </Link>

            <Link to="/favorites" className="min-h-[130px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                <Heart size={24} />
              </div>
              <span className="font-bold text-gray-800 text-sm">الأسئلة المفضلة</span>
            </Link>

            <Link to="/plan" className="min-h-[130px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <MapIcon size={24} />
              </div>
              <span className="font-bold text-gray-800 text-sm">خطتي</span>
            </Link>

            <Link to="/qa" className="min-h-[130px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-3 group">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <HelpCircle size={24} />
              </div>
              <span className="font-bold text-gray-800 text-sm">سؤال وجواب</span>
            </Link>
          </div>

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-4">
              <h3 className="text-lg font-bold">الكورسات النشطة</h3>
              <Link to="/courses" className="text-primary-600 text-sm font-medium">عرض الكل</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeCourses.map((course) => (
                <Card key={course.id} className="flex flex-col h-full">
                  <div className="relative h-32 bg-gray-900">
                    <img src={course.thumbnail} alt={displayText(course.title)} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute top-3 right-3 bg-secondary-500 text-white text-xs font-bold px-2 py-1 rounded">
                      {course.price} {course.currency}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-full">{course.level}</span>
                        <div className="flex items-center text-amber-400 text-sm font-bold">
                          <Star size={14} fill="currentColor" aria-hidden="true" /> {course.rating}
                        </div>
                      </div>
                      <h4 className="font-bold text-gray-900 leading-snug mb-1 break-words">{displayText(course.title)}</h4>
                      <p className="text-xs text-gray-500 mb-3">المدرس: {displayText(course.instructor)}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {course.features.slice(0, 2).map((feat, idx) => (
                          <span key={idx} className="text-[10px] bg-gray-50 border border-gray-100 px-2 py-1 rounded text-gray-600">{displayText(feat)}</span>
                        ))}
                      </div>
                      <Link to={`/course/${course.id}`} className="block w-full bg-secondary-500 hover:bg-secondary-600 text-white text-center py-2 rounded-lg font-bold transition-colors">
                        شراء / متابعة الكورس
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <SmartLearningPath skills={smartSkills} />

          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-4">
              <h3 className="text-lg font-bold">الجدول الدراسي</h3>
            </div>
            <div className="space-y-3">
              {scheduleItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center ${
                    item.status === 'in-progress' ? 'bg-secondary-50 border-secondary-200' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      item.status === 'completed'
                        ? 'bg-primary-100 text-primary-600'
                        : item.status === 'in-progress'
                          ? 'bg-secondary-100 text-secondary-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                    >
                      <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{displayText(item.subject)}</h4>
                      <p className="text-sm text-gray-500">{item.day}</p>
                    </div>
                  </div>
                  <div className="text-right sm:text-left self-start sm:self-auto">
                    <span className="block font-bold text-gray-800">{item.duration}</span>
                    {item.status === 'in-progress' && <span className="text-xs text-secondary-600 font-bold animate-pulse">جاري الآن</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="text-secondary-500" size={20} />
                نقاط الضعف
              </h3>
              <Link to="/reports" className="text-xs text-primary-600 font-bold">التفاصيل</Link>
            </div>

            <div className="space-y-6">
              {smartSkills.slice(0, 2).map((skill, index) => (
                <div key={`${skill.skill}-${index}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700 text-sm">{displayText(skill.skill)}</span>
                    <span className={`text-xs font-bold ${skill.mastery < 50 ? 'text-red-500' : 'text-amber-500'}`}>{skill.mastery}%</span>
                  </div>
                  <ProgressBar percentage={skill.mastery} showPercentage={false} color={skill.mastery < 50 ? 'danger' : 'secondary'} />
                </div>
              ))}
              {smartSkills.length === 0 && (
                <p className="text-sm text-gray-500">ابدأ أول اختبار لتظهر لك نقاط التحسين تلقائيًا.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;

