import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Course } from '../types';
import { CoursePlayer } from '../components/CoursePlayer';
import { CourseLanding } from '../components/CourseLanding';
import { CourseOverview } from '../components/CourseOverview';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { adapter } from '../services/adapter';

const CourseView: React.FC = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [isPlaying, setIsPlaying] = useState(() => searchParams.get('learn') === '1');
    const [certificateCode, setCertificateCode] = useState('');
    const { user, enrolledCourses, hasScopedPackageAccess, courses } = useStore();
    const isStaffViewer = ['admin', 'teacher', 'supervisor'].includes(user.role);

    useEffect(() => {
        setIsPlaying(searchParams.get('learn') === '1');
    }, [searchParams]);

    const updateLearningUrlState = useCallback((nextPlaying: boolean, lessonId?: string) => {
        const nextParams = new URLSearchParams(searchParams);
        if (nextPlaying) {
            nextParams.set('learn', '1');
            if (lessonId) {
                nextParams.set('lesson', lessonId);
            }
        } else {
            nextParams.delete('learn');
            nextParams.delete('lesson');
        }
        setSearchParams(nextParams, { replace: true });
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        let mounted = true;

        const loadCourse = async () => {
            if (!courseId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setLoadError('');
            try {
                const foundCourse = await adapter.getCourseById(courseId);
                if (mounted) {
                    setCourse(foundCourse);
                }
            } catch (error) {
                console.warn('Unable to load course', error);
                if (mounted) {
                    const localCourse = courses.find((item) => item.id === courseId) || null;
                    if (localCourse) {
                        setCourse(localCourse);
                        setLoadError('');
                    } else {
                        setCourse(null);
                        setLoadError('???? ????? ?????? ????. ???? ?? ?????? ?????? ?? ???? ??? ???? ??? ?????.');
                    }
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadCourse();

        return () => {
            mounted = false;
        };
    }, [courseId, courses]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <div className="max-w-md rounded-3xl border border-amber-100 bg-white p-8 shadow-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                        <AlertCircle size={32} />
                    </div>
                    <h1 className="mb-3 text-xl sm:text-2xl font-black leading-tight text-gray-900">?? ????? ??? ??????</h1>
                    <p className="mb-6 text-sm leading-7 text-gray-500">{loadError}</p>
                    <button
                        onClick={() => window.history.back()}
                        className="w-full rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white hover:bg-indigo-700 sm:w-auto"
                    >
                        ?????? ?????
                    </button>
                </div>
            </div>
        );
    }

    const courseIsVisibleToStudent =
        course &&
        course.showOnPlatform !== false &&
        course.isPublished !== false &&
        (!course.approvalStatus || course.approvalStatus === 'approved');

    if (!course || (!isStaffViewer && !courseIsVisibleToStudent)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 leading-tight">?????? ??? ????? ??????</h1>
                <button 
                    onClick={() => window.history.back()}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold w-full sm:w-auto"
                >
                    ?????? ?????
                </button>
            </div>
        );
    }

    const hasPackageAccess = hasScopedPackageAccess('courses', course.pathId || course.category, course.subjectId || course.subject);
    const isEnrolled =
        enrolledCourses.includes(course.id) ||
        (user.subscription?.purchasedCourses || []).includes(course.id) ||
        hasPackageAccess;

    if (isEnrolled) {
        if (isPlaying) {
            return (
                <CoursePlayer
                    course={course}
                    initialLessonId={searchParams.get('lesson') || undefined}
                    onLessonChange={(lessonId) => updateLearningUrlState(true, lessonId)}
                    onBack={() => {
                        setIsPlaying(false);
                        updateLearningUrlState(false);
                    }}
                />
            );
        }
        return (
            <div>
                {course.certificateEnabled && Number(course.progress || 0) >= 100 ? (
                    <div className="mx-auto mb-4 mt-4 w-full max-w-5xl px-4">
                        <button
                            onClick={async () => {
                                try {
                                    const { api } = await import('../services/api');
                                    const cert = await api.generateCertificate({ courseId: course.id });
                                    const code = String(cert?.verificationCode || '');
                                    if (code) {
                                        setCertificateCode(code);
                                        window.location.href = `/certificate/${code}`;
                                    }
                                } catch (e) {
                                    console.warn('Certificate generation failed', e);
                                }
                            }}
                            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700"
                        >
                            ??????
                        </button>
                        {certificateCode ? <p className="mt-2 text-xs text-gray-500">?? ????? ??????? ?????.</p> : null}
                    </div>
                ) : null}
                <CourseOverview
                    course={course}
                    onContinue={() => {
                        setIsPlaying(true);
                        updateLearningUrlState(true);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <CourseLanding course={course} />
        </div>
    );
};

export default CourseView;



