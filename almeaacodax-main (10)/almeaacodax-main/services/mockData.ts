import { Course, ScheduleItem, NavItem, Role, SkillGap, FavoriteQuestion, QuizHistoryItem, QuizResult } from '../types';

export const currentUser = {
    id: 'u1',
    name: 'علي سالم',
    avatar: 'https://i.pravatar.cc/150?u=u1',
    role: Role.STUDENT,
    points: 2450,
    badges: ['المستكشف', 'بطل الرياضيات', 'المواظب'],
    academicStage: 'high_school',
    classNumber: 'grade_1',
    schoolName: 'مدرسة المجد الثانوية',
    phone: '0501234567',
    email: 'alisalem008866@gmail.com'
};

export const skillsData: SkillGap[] = [
    { skill: 'الهندسة', mastery: 45, status: 'weak', recommendation: 'مراجعة قوانين المساحات' },
    { skill: 'الجبر', mastery: 75, status: 'strong' },
    { skill: 'التناظر اللفظي', mastery: 60, status: 'average' }
];

export const saherUpcomingTests = [
    { id: 'st1', title: 'اختبار ساهر الشامل (1)', date: '2025-02-20' },
    { id: 'st2', title: 'تحدي السرعة - كمي', date: '2025-02-22' }
];

export const navigationMenu: NavItem[] = [
    {
        id: 'qudrat',
        label: 'القدرات',
        link: '/category/p_qudrat',
        iconName: 'brain',
        children: [
            { id: 'quant', label: 'الكمي', link: '/category/p_qudrat?subject=sub_quant' },
            { id: 'verbal', label: 'اللفظي', link: '/category/p_qudrat?subject=sub_verbal' },
      { id: 'packages', label: 'عروض وباقات القدرات', link: '/category/p_qudrat?tab=packages' }
        ]
    },
    {
        id: 'tahsili',
        label: 'التحصيلي',
        link: '/category/p_tahsili',
        iconName: 'graduation-cap',
        children: [
            { id: 'math', label: 'الرياضيات', link: '/category/p_tahsili?subject=sub_math' },
            { id: 'physics', label: 'الفيزياء', link: '/category/p_tahsili?subject=sub_physics' },
            { id: 'biology', label: 'الاحياء', link: '/category/p_tahsili?subject=sub_biology' },
            { id: 'chemistry', label: 'الكيمياء', link: '/category/p_tahsili?subject=sub_chemistry' },
      { id: 'packages', label: 'عروض وباقات التحصيلي', link: '/category/p_tahsili?tab=packages' }
        ]
    },
    {
        id: 'nafes',
        label: 'نافس',
        link: '/category/p_nafes',
        iconName: 'book-open',
        children: []
    },
    {
        id: 'tests',
        label: 'اختبارات',
        link: '/tests',
        iconName: 'file-text',
        children: [
            { id: 'test_self', label: 'اختبر نفسك', link: '/quiz' },
            { id: 'prev_tests', label: 'اختبارات سابقة', link: '/quizzes' }
        ]
    },
    {
        id: 'blog',
        label: 'المدونة',
        link: '/blog',
        iconName: 'book'
    }
];

export const courses: Course[] = [
    // القدرات - Qudrat
    {
        id: 'c1',
        title: 'القدرات العامة - القسم الكمي (تأسيس)',
        thumbnail: 'https://picsum.photos/seed/quant/400/250',
        instructor: 'أ. أحمد السالم',
        price: 299,
        currency: 'ر.س',
        duration: 40,
        level: 'Beginner',
        rating: 4.9,
        progress: 45,
        category: 'القدرات',
        subject: 'sub_quant',
        features: ['شرح بالفيديو', 'اختبارات محاكية', 'دعم مباشر'],
        description: 'دورة شاملة لتأسيس القسم الكمي من الصفر حتى الاحتراف مع حل نماذج حديثة.',
        isPurchased: true,
        modules: [
            {
                id: 'm1',
                title: 'الوحدة الأولى ( الأعداد الصحيحة وتطبيقاتها )',
                order: 1,
                lessons: [
                    { id: 'l1', title: 'تأسيس مهارات أساسية قبل البدء', type: 'video', duration: '30 دقيقة', isCompleted: true, videoUrl: 'https://www.youtube.com/embed/M5QGkOGZubQ', order: 1, skillIds: [] },
                    { id: 'l2', title: 'اختبار (1) مهارات أساسية', type: 'quiz', duration: '15 دقيقة', isCompleted: true, quizId: 'qh1', order: 2, skillIds: [] }
                ]
            }
        ]
    },
    {
        id: 'c2',
        title: 'القدرات العامة - القسم اللفظي (تأسيس)',
        thumbnail: 'https://picsum.photos/seed/verbal/400/250',
        instructor: 'أ. سارة المنصور',
        price: 249,
        currency: 'ر.س',
        duration: 35,
        level: 'Beginner',
        rating: 4.8,
        progress: 0,
        category: 'القدرات',
        subject: 'sub_verbal',
        features: ['استراتيجيات الحل', 'نماذج 1446', 'مذكرات شاملة'],
        description: 'شرح مفصل لاستراتيجيات الحل في التناظر اللفظي، إكمال الجمل، والخطأ السياقي.',
        isPurchased: false
    },
    {
        id: 'c7',
        title: 'القدرات العامة - القسم الكمي (مستوى متقدم)',
        thumbnail: 'https://picsum.photos/seed/quant_adv/400/250',
        instructor: 'أ. أحمد السالم',
        price: 349,
        currency: 'ر.س',
        duration: 45,
        level: 'Advanced',
        rating: 4.9,
        progress: 0,
        category: 'القدرات',
        subject: 'sub_quant',
        features: ['حلول سريعة', 'تجميعات المنصف', 'تحديات يومية'],
        description: 'دورة متقدمة تركز على الحلول السريعة والتعامل مع الأسئلة الأكثر صعوبة.',
        isPurchased: false
    },

    // التحصيلي - Tahsili
    {
        id: 'c3',
        title: 'التحصيلي العلمي - رياضيات (شامل)',
        thumbnail: 'https://picsum.photos/seed/tahsili_math/400/250',
        instructor: 'د. فهد التميمي',
        price: 350,
        currency: 'ر.س',
        duration: 50,
        level: 'Intermediate',
        rating: 4.9,
        progress: 15,
        category: 'التحصيلي',
        subject: 'sub_math',
        features: ['مراجعة المناهج الثلاثة', 'حل تجميعات 1445', 'خرائط ذهنية'],
        description: 'مراجعة شاملة لمنهج الرياضيات للمرحلة الثانوية (1، 2، 3) مع حل تجميعات.',
        isPurchased: true
    },
    {
        id: 'c4',
        title: 'التحصيلي العلمي - فيزياء (شامل)',
        thumbnail: 'https://picsum.photos/seed/tahsili_phys/400/250',
        instructor: 'د. أحمد خالد',
        price: 350,
        currency: 'ر.س',
        duration: 45,
        level: 'Intermediate',
        rating: 4.7,
        progress: 0,
        category: 'التحصيلي',
        subject: 'sub_physics',
        features: ['شرح القوانين', 'تجارب افتراضية', 'تجميعات حديثة'],
        description: 'شرح مبسط لقوانين الفيزياء وحل المسائل المعقدة بطرق سهلة وسريعة.',
        isPurchased: false
    },
    {
        id: 'c8',
        title: 'التحصيلي العلمي - كيمياء (شامل)',
        thumbnail: 'https://picsum.photos/seed/tahsili_chem/400/250',
        instructor: 'أ. ليلى الحربي',
        price: 350,
        currency: 'ر.س',
        duration: 40,
        level: 'Intermediate',
        rating: 4.8,
        progress: 0,
        category: 'التحصيلي',
        subject: 'sub_chemistry',
        features: ['تفاعلات كيميائية', 'تسمية المركبات', 'تجميعات 1446'],
        description: 'شرح شامل لمنهج الكيمياء مع التركيز على الأجزاء الأكثر وروداً في الاختبار.',
        isPurchased: false
    },
    {
        id: 'c9',
        title: 'التحصيلي العلمي - أحياء (شامل)',
        thumbnail: 'https://picsum.photos/seed/tahsili_bio/400/250',
        instructor: 'أ. منى القحطاني',
        price: 350,
        currency: 'ر.س',
        duration: 42,
        level: 'Intermediate',
        rating: 4.9,
        progress: 10,
        category: 'التحصيلي',
        subject: 'sub_biology',
        features: ['رسومات توضيحية', 'تصنيف الكائنات', 'مراجعة سريعة'],
        description: 'دورة مبسطة لمنهج الأحياء تعتمد على الصور والخرائط الذهنية لتسهيل الحفظ.',
        isPurchased: true
    },

    // STEP
    {
        id: 'c10',
        title: 'اختبار كفايات اللغة الإنجليزية (STEP) - شامل',
        thumbnail: 'https://picsum.photos/seed/step_english/400/250',
        instructor: 'أ. محمد عبدالله',
        price: 299,
        currency: 'ر.س',
        duration: 30,
        level: 'Beginner',
        rating: 4.8,
        progress: 0,
        category: 'STEP',
        subject: 'sub_step_english',
        features: ['قواعد اللغة', 'استيعاب المقروء', 'الاستماع'],
        description: 'دورة شاملة للتحضير لاختبار كفايات اللغة الإنجليزية (STEP).',
        isPurchased: false
    },

    // باقات - Packages
    {
        id: 'p1',
        title: 'باقة القدرات الشاملة (كمي + لفظي)',
        thumbnail: 'https://picsum.photos/seed/package1/400/250',
        instructor: 'نخبة من المعلمين',
        price: 450,
        originalPrice: 548,
        currency: 'ر.س',
        duration: 75,
        level: 'Beginner',
        rating: 5.0,
        progress: 0,
        category: 'القدرات',
        subject: 'packages',
        isPackage: true,
        packageType: 'courses',
        includedCourses: ['تأسيس الكمي', 'تأسيس اللفظي'],
        features: ['توفير 20%', 'وصول مدى الحياة', 'تحديثات مستمرة'],
        description: 'وفر أكثر مع الباقة الشاملة التي تغطي جميع أقسام اختبار القدرات.'
    }
];

export const schedule: ScheduleItem[] = [
    {
        id: 's1',
        day: 'اليوم',
        subject: 'بث مباشر: مراجعة الهندسة',
        duration: '08:00 م',
        status: 'upcoming',
        isLive: true
    },
    {
        id: 's2',
        day: 'غداً',
        subject: 'اختبار تجريبي: القسم اللفظي',
        duration: '04:00 م',
        status: 'upcoming'
    }
];

export const favoriteQuestions: FavoriteQuestion[] = [
    {
        id: 'fq1',
        courseId: 'c1',
        courseTitle: 'القدرات العامة - القسم الكمي',
        quizTitle: 'اختبار الهندسة',
        text: 'ما مساحة الدائرة التي نصف قطرها 5 سم؟',
        options: ['25π', '10π', '5π', '50π'],
        correctOptionIndex: 0,
        userSelectedOptionIndex: 0,
        explanation: 'مساحة الدائرة = π * نق^2 = π * 5^2 = 25π',
        dateAdded: '2025-02-10'
    }
];

export const myRequests = [
    {
        id: 'REQ-1001',
        courseName: 'القدرات العامة - القسم الكمي (تأسيس)',
        status: 'completed',
        orderDate: '2025-01-15',
        price: 299,
        paymentMethod: 'مدى'
    },
    {
        id: 'REQ-1002',
        courseName: 'التحصيلي العلمي - رياضيات (شامل)',
        status: 'pending',
        orderDate: '2025-02-01',
        price: 350,
        paymentMethod: 'تحويل بنكي'
    }
];

export const mockSkills = {
    quant: [
        { id: 'sk1', title: 'الهندسة', totalLessons: 12, completed: 5, totalQuizzes: 3 },
        { id: 'sk2', title: 'الجبر', totalLessons: 15, completed: 12, totalQuizzes: 4 }
    ],
    verbal: [
        { id: 'sk3', title: 'التناظر اللفظي', totalLessons: 10, completed: 6, totalQuizzes: 2 }
    ],
    math: [
        { id: 'sk4', title: 'حساب المثلثات', totalLessons: 8, completed: 4, totalQuizzes: 2 }
    ],
    physics: [
        { id: 'sk5', title: 'الميكانيكا', totalLessons: 10, completed: 2, totalQuizzes: 1 }
    ]
};

export const mockQuestionBanks = {
    quant: [
        { id: 1, title: 'بنك أسئلة الهندسة الشامل', questions: 50 },
        { id: 2, title: 'بنك أسئلة الجبر الحديث', questions: 40 }
    ],
    verbal: [
        { id: 3, title: 'بنك أسئلة التناظر اللفظي', questions: 30 }
    ],
    math: [
        { id: 6, title: 'بنك أسئلة التفاضل والتكامل', questions: 45 }
    ]
};

export const mockSimTests = {
    quant: [
        { id: 4, title: 'الاختبار المحاكي الأول (كمي)', questions: 60, duration: '60 دقيقة', type: 'simulated', level: 'متوسط', isLocked: false }
    ],
    verbal: [
        { id: 5, title: 'الاختبار المحاكي الأول (لفظي)', questions: 60, duration: '60 دقيقة', type: 'simulated', level: 'متوسط', isLocked: false }
    ],
    math: [
        { id: 7, title: 'الاختبار المحاكي الأول (رياضيات)', questions: 40, duration: '45 دقيقة', type: 'simulated', level: 'متوسط', isLocked: false }
    ]
};

export const mockLibrary = {
    quant: [
        { id: 'l1', title: 'ملخص قوانين الهندسة', type: 'pdf', size: '2.5 MB', downloads: 1250 },
        { id: 'l2', title: 'تجميعات 1445 - كمي', type: 'pdf', size: '5.1 MB', downloads: 3400 }
    ],
    verbal: [
        { id: 'l3', title: 'قاموس الكلمات الصعبة', type: 'pdf', size: '1.8 MB', downloads: 850 }
    ],
    math: [
        { id: 'l4', title: 'ملخص قوانين التفاضل', type: 'pdf', size: '1.2 MB', downloads: 500 }
    ]
};

export const quizHistory: QuizHistoryItem[] = [
    {
        id: 'qh1',
        title: 'اختبار الوحدة الأولى',
        questionCount: 10,
        courseName: 'القدرات العامة - القسم الكمي (تأسيس)',
        passMark: 70,
        difficulty: 'Medium',
        firstAttempt: { score: 60, time: '12:30', date: '2025-01-20' },
        bestAttempt: { score: 90, time: '10:15', date: '2025-01-22' },
        improvement: 30,
        status: 'passed',
        skillsAnalysis: []
    }
];

export const recentQuizResult: QuizResult = {
    quizId: 'qh1',
    quizTitle: 'اختبار الوحدة الأولى',
    score: 90,
    totalQuestions: 10,
    correctAnswers: 9,
    wrongAnswers: 1,
    unanswered: 0,
    timeSpent: '10:15',
    date: '2025-01-22',
    skillsAnalysis: [
        { skill: 'الأعداد الصحيحة', mastery: 100, status: 'strong' },
        { skill: 'الكسور', mastery: 80, status: 'average' }
    ]
};
