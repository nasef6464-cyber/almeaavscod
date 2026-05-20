
export enum Role {
    STUDENT = 'student',
    TEACHER = 'teacher',
    ADMIN = 'admin',
    SUPERVISOR = 'supervisor',
    PARENT = 'parent'
}

export type ContentOwnerType = 'platform' | 'teacher' | 'school';
export type ContentApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface ContentWorkflow {
    ownerType?: ContentOwnerType;
    ownerId?: string;
    createdBy?: string;
    assignedTeacherId?: string;
    approvalStatus?: ContentApprovalStatus;
    approvedBy?: string;
    approvedAt?: number;
    reviewerNotes?: string;
    revenueSharePercentage?: number;
}

export type LessonType = 'video' | 'quiz' | 'file' | 'assignment' | 'text' | 'live_youtube' | 'zoom' | 'google_meet' | 'teams';

export interface InteractiveQuestion {
    id: string;
    timestamp: number; // in seconds
    questionId?: string; // Reference to question bank
    inlineQuestion?: {
        text: string;
        options: string[];
        correctOptionIndex: number;
    };
    mustPass: boolean;
    actionOnFail: 'rewatch' | 'continue';
    rewatchTimestamp?: number; // where to go back if failed
}

export interface Lesson extends ContentWorkflow {
    id: string;
    title: string;
    description?: string;
    pathId?: string;
    subjectId?: string;
    sectionId?: string;
    type: LessonType;
    duration: string;
    isCompleted: boolean;
    content?: string; // For text/article lessons
    videoUrl?: string;
    videoSource?: 'upload' | 'youtube' | 'vimeo';
    interactiveQuestions?: InteractiveQuestion[];
    quizId?: string;
    fileUrl?: string;
    assignmentDetails?: string; // For assignments
    meetingUrl?: string; // For live sessions
    meetingDate?: string;
    recordingUrl?: string;
    joinInstructions?: string;
    showRecordingOnPlatform?: boolean;
    isLocked?: boolean;
    showOnPlatform?: boolean;
    accessControl?: 'public' | 'enrolled' | 'specific_groups';
    allowedGroupIds?: string[];
    order: number; // For drag and drop ordering
    skillIds: string[]; // LINKING LESSON TO SKILLS
}

export interface Module {
    id: string;
    title: string;
    order: number;
    lessons: Lesson[];
}

export interface CourseFile {
    id: string;
    title: string;
    type: 'pdf' | 'doc' | 'image';
    url: string;
    size: string;
}

export interface CourseQA {
    id: string;
    question: string;
    answer?: string;
    user: string;
    date: string;
}

export type CourseAssessmentPhase = 'pre_course' | 'during_course' | 'final_course';
export type CourseAssessmentAccess = 'free_preview' | 'enrolled_paid';

export interface CourseAssessment {
    id: string;
    quizId: string;
    title: string;
    phase: CourseAssessmentPhase;
    access: CourseAssessmentAccess;
    showOnPlatform: boolean;
    order: number;
}

export interface Course extends ContentWorkflow {
    id: string;
    title: string;
    thumbnail: string;
    instructor: string;
    price: number;
    currency: string;
    duration: number; // hours
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    rating: number;
    progress: number; // 0-100
    category: string;
    subject?: string;
    pathId?: string;
    subjectId?: string;
    sectionId?: string;
    features: string[];
    description?: string;
    instructorBio?: string;
    modules?: Module[];
    syllabus?: any[];
    isPurchased?: boolean;
    isPackage?: boolean;
    packageType?: 'courses' | 'videos' | 'tests' | 'membership';
    packageContentTypes?: PackageContentType[];
    originalPrice?: number;
    includedCourses?: string[];
    studentCount?: number;
    weeksCount?: number;
    previewVideoUrl?: string;
    files?: CourseFile[];
    qa?: CourseQA[];
    assessments?: CourseAssessment[];
    // Advanced LMS Features
    isPublished?: boolean;
    showOnPlatform?: boolean;
    prerequisiteCourseIds?: string[];
    dripContentEnabled?: boolean;
    certificateEnabled?: boolean;
    fakeRating?: number;
    fakeStudentsCount?: number;
    skills?: string[]; // Array of skill IDs
}

export interface ScheduleItem {
    id: string;
    day: string;
    subject: string;
    duration: string;
    status: 'completed' | 'in-progress' | 'upcoming';
    isLive?: boolean;
}

export interface PathDisplaySettings {
    showSubjectCards?: boolean;
    showMockExamCard?: boolean;
    showPackageCard?: boolean;
}

export interface CategoryPath {
    id: string;
    name: string;
    color?: string;
    icon?: string;
    iconUrl?: string; // Added for custom icon uploads
    iconStyle?: 'default' | 'modern' | 'minimal' | 'playful'; // Added for varying designs
    showInNavbar?: boolean;
    showInHome?: boolean;
    isActive?: boolean; // To hide/show paths completely
    parentPathId?: string; // To nest paths under other paths
    description?: string;
    settings?: PathDisplaySettings;
}

export interface CategoryLevel {
    id: string;
    pathId: string;
    name: string;
}

export interface SubjectSettings {
    showCourses?: boolean;
    showSkills?: boolean;
    showBanks?: boolean;
    showTests?: boolean;
    showLibrary?: boolean;
    lockSkillsForNonSubscribers?: boolean;
    lockBanksForNonSubscribers?: boolean;
    lockTestsForNonSubscribers?: boolean;
    lockLibraryForNonSubscribers?: boolean;
}

export interface CategorySubject {
    id: string;
    pathId: string;
    levelId?: string;
    name: string;
    icon?: string;
    color?: string;
    iconUrl?: string; // Added for custom subject icons
    iconStyle?: 'default' | 'modern' | 'minimal' | 'playful'; // Added for varying designs
    settings?: SubjectSettings;
}

export interface CategorySection {
    id: string;
    subjectId: string;
    name: string;
}

// Nested Skill Structure for UI (Skills Tree)
export interface NestedSubSkill {
    id: string;
    name: string;
    description: string;
    isLocked: boolean;
    progress?: number;
    lessons: Lesson[];
    quizzes: { id: string; title: string; questionCount: number; isCompleted?: boolean }[];
}

export interface Topic {
    id: string;
    subjectId: string;
    pathId?: string;
    sectionId?: string;
    title: string;
    parentId?: string | null; // null or undefined for main topics
    order: number;
    showOnPlatform?: boolean;
    isLocked?: boolean;
    lessonIds: string[]; // attached lessons from library
    quizIds: string[]; // attached quizzes from quiz center
    libraryItemIds?: string[]; // attached support files from library
}

export interface NestedSkill {
    id: string;
    name: string;
    description: string;
    isLocked: boolean;
    progress?: number;
    pathId?: string;
    subjectId?: string;
    sectionId?: string;
    subSkills: NestedSubSkill[];
}

export interface Skill {
    id: string;
    name: string;
    pathId: string;
    subjectId: string;
    sectionId: string;
    description?: string;
    lessonIds: string[]; // Lessons (videos/articles) that teach this skill
    questionIds: string[]; // Questions that test this skill
    createdAt: number;
}

export interface SkillGap {
    skillId?: string;
    pathId?: string;
    subjectId?: string;
    sectionId?: string;
    section?: string;
    skill: string;
    mastery: number; // 0-100 percentage
    status: 'weak' | 'average' | 'strong';
    recommendation?: string; // Action text like "Additional test available"
}

export interface SkillProgress {
    id?: string;
    userId: string;
    skillId: string;
    skill: string;
    pathId?: string;
    subjectId?: string;
    sectionId?: string;
    mastery: number;
    status: 'weak' | 'average' | 'good' | 'mastered';
    attempts: number;
    lastQuizId?: string;
    lastQuizTitle?: string;
    lastAttemptAt?: string;
    recommendedAction?: string;
}

export interface QuizQuestionReview {
    questionId: string;
    text: string;
    options: string[];
    correctOptionIndex: number;
    selectedOptionIndex?: number;
    explanation?: string;
    videoUrl?: string;
    imageUrl?: string;
    isCorrect: boolean;
}

export interface QuizResult {
    userId?: string;
    quizId: string;
    quizTitle: string;
    source?: 'foundation' | 'training' | 'tests' | 'mock-exam' | 'course' | 'self' | string;
    returnTo?: string;
    score: number; // percentage
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    unanswered: number;
    timeSpent: string;
    date: string;
    skillsAnalysis: SkillGap[];
    questionReview?: QuizQuestionReview[];
}

export interface QuizHistoryItem {
    id: string;
    title: string;
    questionCount: number;
    courseName: string;
    passMark: number;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    firstAttempt: {
        score: number;
        time: string;
        date: string;
    };
    bestAttempt: {
        score: number;
        time: string;
        date: string;
    };
    improvement: number; // percentage change
    status: 'passed' | 'failed';
    skillsAnalysis: SkillGap[]; // For the detail view
}

export interface QuizSettings {
    showExplanations: boolean;
    showAnswers: boolean;
    showResultsReport?: boolean;
    returnToSourceOnFinish?: boolean;
    maxAttempts: number;
    passingScore: number; // percentage
    timeLimit?: number; // in minutes
    randomizeQuestions?: boolean;
    showProgressBar?: boolean;
    requireAnswerBeforeNext?: boolean;
    allowQuestionReview?: boolean;
    optionLayout?: 'auto' | 'horizontal' | 'two_columns';
}

export interface QuizAccess {
    type: 'free' | 'paid' | 'private' | 'course_only';
    price?: number;
    allowedGroupIds?: string[];
}

export interface QuizLearningPlacement {
    pathId: string;
    subjectId?: string;
    slot: 'training' | 'tests' | 'foundation' | 'course';
    accessType?: 'inherit' | 'free' | 'paid';
    isVisible?: boolean;
    order?: number;
    createdAt?: number;
    updatedAt?: number;
}

export interface MockExamSection {
    id: string;
    title: string;
    subjectId?: string;
    questionIds: string[];
    timeLimit?: number;
    order?: number;
}

export interface MockExamConfig {
    enabled: boolean;
    pathId: string;
    sections: MockExamSection[];
}

export interface Quiz extends ContentWorkflow {
    id: string;
    title: string;
    description?: string;
    pathId: string;
    subjectId: string;
    sectionId?: string;
    type?: 'quiz' | 'bank'; // Added type for Training vs Simulated Test
    placement?: 'training' | 'mock' | 'both';
    showInTraining?: boolean;
    showInMock?: boolean;
    learningPlacements?: QuizLearningPlacement[];
    mockExam?: MockExamConfig;
    mode?: 'regular' | 'saher' | 'central';
    settings: QuizSettings;
    access: QuizAccess;
    questionIds: string[]; // References to Question bank
    createdAt: number;
    isPublished: boolean;
    showOnPlatform?: boolean;
    skillIds?: string[];
    targetGroupIds?: string[];
    targetUserIds?: string[];
    dueDate?: string;
}

export interface Question extends ContentWorkflow {
    id: string;
    text: string;
    options: string[];
    correctOptionIndex: number;
    explanation?: string;
    videoUrl?: string;
    imageUrl?: string;
    skillIds?: string[];
    pathId?: string; // Added to support Path selection
    subject: string;
    sectionId?: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    type: 'mcq' | 'true_false' | 'essay';
}

export interface QuestionAttempt {
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
    timeSpentSeconds: number;
    date: string;
}

export interface Activity {
    id: string;
    type: 'course_view' | 'lesson_complete' | 'quiz_complete' | 'skill_practice' | 'session_booked';
    title: string;
    date: string;
    link?: string;
}

export interface UserSubscription {
    plan: 'free' | 'premium';
    expiresAt?: string;
    purchasedCourses: string[];
    purchasedPackages: string[];
}

export type PackageContentType = 'courses' | 'foundation' | 'banks' | 'tests' | 'library' | 'all';

export type PaymentMethodKey = 'card' | 'transfer' | 'wallet';

export interface PaymentMethodSettings {
    enabled: boolean;
    label: string;
    accountName?: string;
    accountNumber?: string;
    iban?: string;
    bankName?: string;
    instructions?: string;
    phoneNumber?: string;
    providerName?: string;
    providerCode?: string;
    gatewayMode?: 'manual_review' | 'payment_link' | 'webhook';
    supportedCountries?: string[];
    publishDetailsToStudents?: boolean;
}

export interface PaymentSettings {
    key: string;
    currency: string;
    manualReviewRequired: boolean;
    webhookEnabled?: boolean;
    webhookSecret?: string;
    card: PaymentMethodSettings;
    transfer: PaymentMethodSettings;
    wallet: PaymentMethodSettings;
    notes?: string;
}

export type PaymentRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface PaymentRequest {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    itemType: 'course' | 'package' | 'skill' | 'test';
    itemId: string;
    itemName: string;
    packageId?: string;
    includedCourseIds?: string[];
    originalAmount?: number | null;
    discountAmount?: number;
    discountCodeId?: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethodKey;
    status: PaymentRequestStatus;
    transferReference?: string;
    walletNumber?: string;
    receiptUrl?: string;
    discountCode?: string;
    notes?: string;
    approvalEvidence?: string;
    paymentProviderCode?: string;
    paymentGatewayMode?: string;
    paymentCountry?: string;
    gatewayProvider?: string;
    gatewayTransactionId?: string;
    gatewayEventId?: string;
    gatewayPaidAt?: number | null;
    reviewedBy?: string;
    reviewedAt?: number | null;
    reviewerNotes?: string;
    createdAt?: string | number;
    updatedAt?: string | number;
}

export interface DiscountCode {
    id?: string;
    _id?: string;
    code: string;
    label?: string;
    type: 'percentage' | 'fixed';
    value: number;
    status: 'active' | 'paused' | 'expired';
    minAmount?: number;
    maxRedemptions?: number;
    currentRedemptions?: number;
    startsAt?: number | null;
    expiresAt?: number | null;
    packageIds?: string[];
    pathIds?: string[];
    subjectIds?: string[];
    contentTypes?: PackageContentType[];
    createdAt?: string | number;
    updatedAt?: string | number;
}

export interface HomepageHeroSettings {
    badgeText?: string;
    titlePrefix?: string;
    titleHighlight?: string;
    titleSuffix?: string;
    description?: string;
    primaryCtaLabel?: string;
    primaryCtaLink?: string;
    secondaryCtaLabel?: string;
    secondaryCtaLink?: string;
    imageUrl?: string;
    imageAlt?: string;
    floatingCardTitle?: string;
    floatingCardSubtitle?: string;
    floatingCardProgressLabel?: string;
    floatingCardProgressValue?: string;
}

export interface HomepageStat {
    id: string;
    label: string;
    mode: 'dynamic' | 'manual';
    source: 'students' | 'courses' | 'assets' | 'rating';
    manualValue?: string;
}

export interface HomepageTestimonial {
    id: string;
    name: string;
    degree?: string;
    text: string;
    image?: string;
}

export interface HomepageSections {
    featuredCoursesTitle?: string;
    featuredCoursesSubtitle?: string;
    featuredArticlesTitle?: string;
    featuredArticlesSubtitle?: string;
    whyChooseTitle?: string;
    whyChooseDescription?: string;
    testimonialsTitle?: string;
    testimonialsSubtitle?: string;
}

export type HomepageFontFamily = 'tajawal' | 'system' | 'serif';
export type HomepageHeadingWeight = 'bold' | 'black';

export interface HomepageTypography {
    headingFont?: HomepageFontFamily;
    bodyFont?: HomepageFontFamily;
    headingWeight?: HomepageHeadingWeight;
}

export interface HomepageSettings {
    key: string;
    hero: HomepageHeroSettings;
    stats: HomepageStat[];
    testimonials: HomepageTestimonial[];
    sections: HomepageSections;
    typography?: HomepageTypography;
    featuredPathIds: string[];
    featuredCourseIds: string[];
    featuredArticleLessonIds?: string[];
}

export type PlatformFontFamily =
    | 'tajawal'
    | 'cairo'
    | 'almarai'
    | 'readex-pro'
    | 'ibm-plex-sans-arabic'
    | 'noto-naskh-arabic'
    | 'noto-kufi-arabic'
    | 'system'
    | 'custom';

export interface PlatformFontUpload {
    name?: string;
    dataUrl?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
}

export interface PlatformFontSettings {
    key: string;
    bodyFont: PlatformFontFamily;
    headingFont: PlatformFontFamily;
    navigationFont?: PlatformFontFamily;
    buttonFont?: PlatformFontFamily;
    bodySize?: string;
    headingSize?: string;
    navigationSize?: string;
    buttonSize?: string;
    bodyWeight?: string;
    headingWeight?: string;
    navigationWeight?: string;
    buttonWeight?: string;
    bodyColor?: string;
    headingColor?: string;
    navigationColor?: string;
    buttonColor?: string;
    bodyCustomFont?: PlatformFontUpload;
    headingCustomFont?: PlatformFontUpload;
    updatedAt?: string | number;
}

export interface User {
    id: string;
    name: string;
    email?: string;
    avatar: string;
    role: Role;
    points: number;
    badges: string[];
    subscription: UserSubscription;
    isActive?: boolean;
    schoolId?: string;
    groupIds?: string[];
    linkedStudentIds?: string[];
    managedPathIds?: string[];
    managedSubjectIds?: string[];
}

export type GroupType = 'SCHOOL' | 'CLASS' | 'PRIVATE_GROUP';

export interface B2BPackage {
    id: string;
    schoolId: string;
    name: string;
    assignedTeacherId?: string;
    revenueSharePercentage?: number;
    courseIds: string[];
    contentTypes: PackageContentType[];
    pathIds: string[];
    subjectIds: string[];
    type: 'free_access' | 'discounted';
    discountPercentage?: number;
    maxStudents: number;
    status: 'active' | 'expired';
    createdAt: number;
}

export type AnnouncementAudience = 'all' | 'guest' | 'student' | 'parent' | 'staff';
export type AnnouncementDisplayMode = 'modal' | 'top-banner';
export type AnnouncementFrequency = 'always' | 'session' | 'once';
export type AnnouncementImageFit = 'cover' | 'contain';

export interface AnnouncementAd {
    id: string;
    title: string;
    body?: string;
    imageUrl?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    audience: AnnouncementAudience;
    displayMode?: AnnouncementDisplayMode;
    frequency?: AnnouncementFrequency;
    imageFit?: AnnouncementImageFit;
    delaySeconds?: number;
    isActive: boolean;
    priority: number;
    startsAt?: number;
    endsAt?: number;
    createdAt: number;
    updatedAt?: number;
}

export interface AccessCode {
    id: string;
    code: string;
    schoolId: string;
    packageId: string;
    maxUses: number;
    currentUses: number;
    expiresAt: number;
    createdAt: number;
}

export interface Group {
    id: string;
    name: string;
    type: GroupType;
    parentId?: string; // For classes belonging to a school
    ownerId: string;
    supervisorIds: string[];
    studentIds: string[];
    courseIds: string[];
    createdAt: number;
    metadata?: {
        description?: string;
        location?: string;
        settings?: any;
    };
    // Computed fields for analytics preparation
    totalStudents?: number;
    totalSupervisors?: number;
    totalCourses?: number;
    activityScore?: number;
    performanceScore?: number;
}

export interface NavItem {
    id: string;
    label: string;
    link: string;
    iconName?: string;
    children?: NavItem[];
}

export interface FavoriteQuestion {
    id: string;
    courseId: string;
    courseTitle: string;
    quizTitle: string;
    text: string;
    imageUrl?: string;
    videoUrl?: string; // YouTube Embed URL
    options: string[];
    correctOptionIndex: number;
    userSelectedOptionIndex?: number;
    explanation?: string;
    dateAdded: string;
}

export interface LibraryItem extends ContentWorkflow {
    id: string;
    title: string;
    size: string;
    downloads: number;
    type: 'pdf' | 'doc' | 'video';
    pathId?: string;
    subjectId: string;
    sectionId?: string;
    skillIds?: string[];
    url?: string;
    showOnPlatform?: boolean;
    isLocked?: boolean;
  }

// AI Learning Path Types
export interface LearningRecommendation {
    id: string;
    type: 'lesson' | 'quiz' | 'flashcard';
    title: string;
    duration: string; // e.g., "15 دقيقة"
    reason: string; // AI generated reason
    skillTargeted: string;
    priority: 'high' | 'medium' | 'low';
    actionLabel: string;
    link: string;
}

export type StudyPlanDay =
    | 'saturday'
    | 'sunday'
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday';

export interface StudyPlan {
    id: string;
    userId: string;
    name: string;
    pathId: string;
    subjectIds: string[];
    courseIds: string[];
    startDate: string;
    endDate: string;
    skipCompletedQuizzes: boolean;
    offDays: StudyPlanDay[];
    dailyMinutes: number;
    preferredStartTime?: string;
    status: 'active' | 'archived';
    createdAt: number;
    updatedAt: number;
}
