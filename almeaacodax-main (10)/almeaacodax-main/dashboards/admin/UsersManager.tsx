import React, { useEffect, useMemo, useState } from 'react';
import { Download, Edit2, Filter, MoreVertical, Plus, Search, UserCheck, UserX, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { CategoryPath, CategorySubject, Role, User } from '../../types';
import { api } from '../../services/api';
import { loadXlsx } from '../../utils/xlsxLoader';

type AdminUserPayload = {
    id?: string;
    _id?: string;
    name: string;
    email: string;
    avatar?: string;
    role: Role;
    points?: number;
    badges?: string[];
    isActive?: boolean;
    schoolId?: string | null;
    groupIds?: string[];
    linkedStudentIds?: string[];
    managedPathIds?: string[];
    managedSubjectIds?: string[];
    subscription?: {
        plan?: 'free' | 'premium';
        purchasedCourses?: string[];
        purchasedPackages?: string[];
    };
};

const buildStoreUser = (user: AdminUserPayload): User => ({
    id: String(user.id || user._id || user.email),
    name: user.name,
    email: user.email,
    avatar: user.avatar || `https://i.pravatar.cc/150?u=${encodeURIComponent(user.email)}`,
    role: user.role,
    points: user.points ?? 0,
    badges: user.badges ?? [],
    isActive: user.isActive ?? true,
    schoolId: user.schoolId ?? undefined,
    groupIds: user.groupIds ?? [],
    linkedStudentIds: user.linkedStudentIds ?? [],
    managedPathIds: user.managedPathIds ?? [],
    managedSubjectIds: user.managedSubjectIds ?? [],
    subscription: {
        plan: user.subscription?.plan ?? 'free',
        purchasedCourses: user.subscription?.purchasedCourses ?? [],
        purchasedPackages: user.subscription?.purchasedPackages ?? [],
    },
});

const roleLabels: Record<Role, string> = {
    [Role.ADMIN]: 'مدير',
    [Role.SUPERVISOR]: 'مشرف',
    [Role.TEACHER]: 'معلم',
    [Role.PARENT]: 'ولي أمر',
    [Role.STUDENT]: 'طالب',
};

const createWorkbookDownload = async (
    fileName: string,
    sheets: Array<{ name: string; rows: Array<Array<string | number>> }>,
) => {
    const XLSX = await loadXlsx();
    const workbook = XLSX.utils.book_new();
    sheets.forEach((sheet) => {
        const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
    });
    XLSX.writeFile(workbook, fileName);
};

const MultiSelectField: React.FC<{
    value: string[];
    options: { value: string; label: string }[];
    placeholder: string;
    onChange: (next: string[]) => void;
    size?: 'sm' | 'md';
}> = ({ value, options, placeholder, onChange, size = 'md' }) => (
    <select
        multiple
        value={value}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value))}
        className={`w-full border border-gray-300 rounded-lg px-3 ${
            size === 'sm' ? 'py-2 h-28 text-sm' : 'py-2.5 h-32 text-sm'
        } focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white`}
    >
        {options.length === 0 ? (
            <option disabled value="">
                {placeholder}
            </option>
        ) : (
            options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))
        )}
    </select>
);

const resolveTeacherSubjects = (
    managedPathIds: string[],
    subjects: CategorySubject[],
): CategorySubject[] => {
    if (!managedPathIds.length) return subjects;
    return subjects.filter((subject) => managedPathIds.includes(subject.pathId));
};

export const UsersManager: React.FC = () => {
    const {
        users,
        groups,
        paths,
        subjects,
        hydrateUsers,
        addUser,
        updateUser,
        toggleUserStatus,
        assignStudentToGroup,
        removeStudentFromGroup,
        assignSupervisorToGroup,
        removeSupervisorFromGroup,
    } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    const [usersLoadError, setUsersLoadError] = useState('');
    const [createError, setCreateError] = useState('');
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: Role.STUDENT as Role,
        linkedStudentIds: [] as string[],
        managedPathIds: [] as string[],
        managedSubjectIds: [] as string[],
    });

    const schools = useMemo(() => groups.filter((group) => group.type === 'SCHOOL'), [groups]);
    const classes = useMemo(() => groups.filter((group) => group.type === 'CLASS'), [groups]);
    const students = useMemo(() => users.filter((user) => user.role === Role.STUDENT), [users]);
    const pathOptions = useMemo(() => paths.map((path) => ({ value: path.id, label: path.name })), [paths]);
    const teacherSubjectOptions = useMemo(() => {
        return resolveTeacherSubjects(newUser.managedPathIds, subjects).map((subject) => ({
            value: subject.id,
            label: subject.name,
        }));
    }, [newUser.managedPathIds, subjects]);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesSearch =
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [roleFilter, searchTerm, users]);
    const usersByRole = useMemo(() => {
        return Object.values(Role).reduce((acc, role) => {
            acc[role] = users.filter((user) => user.role === role).length;
            return acc;
        }, {} as Record<Role, number>);
    }, [users]);
    const inactiveUsersCount = useMemo(() => users.filter((user) => user.isActive === false).length, [users]);
    const scopedTeachersCount = useMemo(
        () => users.filter((user) => user.role === Role.TEACHER && ((user.managedPathIds?.length || 0) > 0 || (user.managedSubjectIds?.length || 0) > 0)).length,
        [users],
    );
    const manageableFilteredUsers = useMemo(
        () => filteredUsers.filter((user) => user.role !== Role.ADMIN),
        [filteredUsers],
    );
    const visibleActiveCount = useMemo(
        () => manageableFilteredUsers.filter((user) => user.isActive !== false).length,
        [manageableFilteredUsers],
    );
    const visibleInactiveCount = useMemo(
        () => manageableFilteredUsers.filter((user) => user.isActive === false).length,
        [manageableFilteredUsers],
    );

    useEffect(() => {
        if (users.length > 0 || isUsersLoading) {
            return;
        }

        let isMounted = true;
        setIsUsersLoading(true);
        setUsersLoadError('');

        api.getAdminUsers()
            .then((response) => {
                if (!isMounted) return;
                hydrateUsers((response.users || []).map(buildStoreUser));
            })
            .catch((error) => {
                if (!isMounted) return;
                console.error('Failed to load admin users:', error);
                setUsersLoadError('تعذر تحميل المستخدمين الآن. حاول تحديث التبويب بعد لحظات.');
            })
            .finally(() => {
                if (isMounted) {
                    setIsUsersLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [hydrateUsers, isUsersLoading, users.length]);

    const handleRoleChange = (userId: string, newRole: Role) => {
        updateUser(userId, { role: newRole });
    };

    const startEditingUser = (user: User) => {
        setEditingUserId(user.id);
        setNameDrafts((current) => ({
            ...current,
            [user.id]: user.name,
        }));
    };

    const saveUserName = (user: User) => {
        const nextName = (nameDrafts[user.id] ?? user.name).trim();
        if (nextName.length < 2 || nextName === user.name) {
            return;
        }

        updateUser(user.id, { name: nextName });
    };

    const stopEditingUser = (user: User) => {
        saveUserName(user);
        setEditingUserId(null);
        setNameDrafts((current) => {
            const next = { ...current };
            delete next[user.id];
            return next;
        });
    };

    const handleCreateUser = async () => {
        if (!newUser.name.trim() || !newUser.email.trim() || newUser.password.trim().length < 6) {
            setCreateError('أدخل الاسم والبريد الإلكتروني وكلمة مرور لا تقل عن 6 أحرف.');
            return;
        }

        try {
            setIsSubmitting(true);
            setCreateError('');

            const response = await api.createAdminUser({
                name: newUser.name.trim(),
                email: newUser.email.trim(),
                password: newUser.password,
                role: newUser.role,
                linkedStudentIds: newUser.role === Role.PARENT ? newUser.linkedStudentIds : [],
                managedPathIds: newUser.role === Role.TEACHER ? newUser.managedPathIds : [],
                managedSubjectIds: newUser.role === Role.TEACHER ? newUser.managedSubjectIds : [],
            }) as { user?: AdminUserPayload };

            if (response.user) {
                addUser(buildStoreUser(response.user));
            }

            setNewUser({
                name: '',
                email: '',
                password: '',
                role: Role.STUDENT,
                linkedStudentIds: [],
                managedPathIds: [],
                managedSubjectIds: [],
            });
            setIsCreateOpen(false);
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : 'تعذر إنشاء المستخدم الآن.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const exportUsersWorkbook = () => {
        const userRows: Array<Array<string | number>> = [
            ['الاسم', 'البريد الإلكتروني', 'الدور', 'الحالة', 'المدرسة', 'الفصل/المجموعة', 'نطاق المعلم', 'الأبناء المرتبطون'],
            ...filteredUsers.map((currentUser) => {
                const schoolName = resolveSchoolName(currentUser) || '';
                const userGroups = groups
                    .filter((group) => currentUser.groupIds?.includes(group.id))
                    .map((group) => group.name)
                    .join('، ');
                const { pathNames, subjectNames } = resolveTeacherScope(currentUser);
                const linkedStudents = users
                    .filter((student) => currentUser.linkedStudentIds?.includes(student.id))
                    .map((student) => student.name)
                    .join('، ');

                return [
                    currentUser.name,
                    currentUser.email || '',
                    roleLabels[currentUser.role],
                    currentUser.isActive === false ? 'متوقف' : 'نشط',
                    schoolName,
                    userGroups,
                    [...pathNames, ...subjectNames].join('، '),
                    linkedStudents,
                ];
            }),
        ];

        const roleRows: Array<Array<string | number>> = [
            ['الدور', 'العدد'],
            ...Object.values(Role).map((role) => [roleLabels[role], usersByRole[role] || 0]),
            ['مستخدمون متوقفون', inactiveUsersCount],
            ['معلمون بنطاق تدريس محدد', scopedTeachersCount],
        ];

        createWorkbookDownload('platform-users-operational-report.xlsx', [
            { name: 'users', rows: userRows },
            { name: 'roles', rows: roleRows },
        ]);
    };

    const getRoleBadge = (role: Role) => {
        switch (role) {
            case Role.ADMIN:
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">مدير</span>;
            case Role.SUPERVISOR:
                return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">مشرف</span>;
            case Role.TEACHER:
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">معلم</span>;
            case Role.PARENT:
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">ولي أمر</span>;
            case Role.STUDENT:
                return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">طالب</span>;
            default:
                return null;
        }
    };

    const resolveSchoolName = (user: User) => {
        if (!user.schoolId) return null;
        return schools.find((group) => group.id === user.schoolId)?.name || null;
    };

    const resolveClassName = (user: User) => {
        const classGroup = classes.find((group) => user.groupIds?.includes(group.id));
        return classGroup?.name || null;
    };

    const resolveTeacherScope = (user: User) => {
        const pathNames = paths
            .filter((path) => user.managedPathIds?.includes(path.id))
            .map((path) => path.name);
        const subjectNames = subjects
            .filter((subject) => user.managedSubjectIds?.includes(subject.id))
            .map((subject) => subject.name);

        return { pathNames, subjectNames };
    };

    const handleStudentSchoolChange = (user: User, nextSchoolId: string) => {
        if (user.schoolId && user.schoolId !== nextSchoolId) {
            removeStudentFromGroup(user.id, user.schoolId);
        }

        if (nextSchoolId) {
            assignStudentToGroup(user.id, nextSchoolId);
        } else {
            updateUser(user.id, { schoolId: undefined });
        }
    };

    const handleStudentClassChange = (user: User, nextClassId: string) => {
        const currentClassId = classes.find((group) => user.groupIds?.includes(group.id))?.id;
        if (currentClassId && currentClassId !== nextClassId) {
            removeStudentFromGroup(user.id, currentClassId);
        }

        if (nextClassId) {
            assignStudentToGroup(user.id, nextClassId);
        }
    };

    const handleSupervisorGroupsChange = (user: User, nextGroupIds: string[]) => {
        const currentGroupIds = user.groupIds || [];
        currentGroupIds
            .filter((groupId) => !nextGroupIds.includes(groupId))
            .forEach((groupId) => removeSupervisorFromGroup(user.id, groupId));

        nextGroupIds
            .filter((groupId) => !currentGroupIds.includes(groupId))
            .forEach((groupId) => assignSupervisorToGroup(user.id, groupId));
    };

    const handleParentSchoolChange = (user: User, nextSchoolId: string) => {
        const nextLinkedStudents = (user.linkedStudentIds || []).filter((studentId) => {
            const linkedStudent = students.find((student) => student.id === studentId);
            return !nextSchoolId || linkedStudent?.schoolId === nextSchoolId;
        });

        updateUser(user.id, {
            schoolId: nextSchoolId || undefined,
            linkedStudentIds: nextLinkedStudents,
        });
    };

    const handleParentLinkedStudentsChange = (userId: string, linkedStudentIds: string[]) => {
        updateUser(userId, { linkedStudentIds });
    };

    const handleTeacherPathsChange = (user: User, nextPathIds: string[]) => {
        const nextSubjects = (user.managedSubjectIds || []).filter((subjectId) => {
            const subject = subjects.find((item) => item.id === subjectId);
            return subject && nextPathIds.includes(subject.pathId);
        });

        updateUser(user.id, {
            managedPathIds: nextPathIds,
            managedSubjectIds: nextSubjects,
        });
    };

    const handleTeacherSubjectsChange = (userId: string, managedSubjectIds: string[]) => {
        updateUser(userId, { managedSubjectIds });
    };

    const setFilteredUsersStatus = (active: boolean) => {
        if (manageableFilteredUsers.length === 0) {
            return;
        }

        manageableFilteredUsers.forEach((currentUser) => {
            if ((currentUser.isActive ?? true) !== active) {
                toggleUserStatus(currentUser.id);
            }
        });
    };

    const renderTeacherScopeEditor = (user: User) => {
        const selectedPathIds = user.managedPathIds || [];
        const subjectOptions = resolveTeacherSubjects(selectedPathIds, subjects).map((subject) => ({
            value: subject.id,
            label: subject.name,
        }));

        return (
            <div className="space-y-2 min-w-[280px]">
                <MultiSelectField
                    value={selectedPathIds}
                    options={pathOptions}
                    placeholder="أضف مسارًا واحدًا على الأقل"
                    onChange={(nextPathIds) => handleTeacherPathsChange(user, nextPathIds)}
                    size="sm"
                />
                <MultiSelectField
                    value={user.managedSubjectIds || []}
                    options={subjectOptions}
                    placeholder="اختر المواد التابعة للمسارات"
                    onChange={(nextSubjectIds) => handleTeacherSubjectsChange(user.id, nextSubjectIds)}
                    size="sm"
                />
                <p className="text-[11px] text-gray-400">
                    المعلم يدخل المحتوى داخل هذا النطاق فقط، ويظهر بعد اعتماد الإدارة.
                </p>
            </div>
        );
    };

    const renderAssignmentSummary = (user: User) => {
        if (user.role === Role.TEACHER) {
            const { pathNames, subjectNames } = resolveTeacherScope(user);

            if (!pathNames.length && !subjectNames.length) {
                return <span className="text-sm text-gray-400">بدون نطاق تدريس</span>;
            }

            return (
                <div className="flex flex-wrap gap-1">
                    {pathNames.map((name) => (
                        <span key={`path-${name}`} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                            {name}
                        </span>
                    ))}
                    {subjectNames.map((name) => (
                        <span key={`subject-${name}`} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                            {name}
                        </span>
                    ))}
                </div>
            );
        }

        return (
            <div className="flex flex-wrap gap-1">
                {resolveSchoolName(user) && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {resolveSchoolName(user)}
                    </span>
                )}
                {resolveClassName(user) && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {resolveClassName(user)}
                    </span>
                )}
                {user.role === Role.PARENT && !!user.linkedStudentIds?.length && (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs">
                        الأبناء المرتبطون: {user.linkedStudentIds.length}
                    </span>
                )}
                {!resolveSchoolName(user) && !resolveClassName(user) && !(user.role === Role.PARENT && !!user.linkedStudentIds?.length) && (
                    <span className="text-sm text-gray-400">-</span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h1>
                    <p className="text-gray-500 text-sm mt-1">إدارة الأدوار، نطاق المعلمين، المدارس والفصول، وربط ولي الأمر والطلاب.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={exportUsersWorkbook}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Download size={18} />
                        <span>تصدير المستخدمين</span>
                    </button>
                <button
                    onClick={() => {
                        setIsCreateOpen(true);
                        setCreateError('');
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>إضافة مستخدم</span>
                </button>
                </div>
            </div>

            {(isUsersLoading || usersLoadError) && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${usersLoadError ? 'border-red-100 bg-red-50 text-red-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                    {usersLoadError || 'جاري تحميل المستخدمين داخل هذا التبويب فقط...'}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">الطلاب</p>
                    <p className="text-2xl font-black text-gray-900">{usersByRole[Role.STUDENT] || 0}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">المعلمون</p>
                    <p className="text-2xl font-black text-gray-900">{usersByRole[Role.TEACHER] || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">{scopedTeachersCount} بنطاق محدد</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">المشرفون</p>
                    <p className="text-2xl font-black text-gray-900">{usersByRole[Role.SUPERVISOR] || 0}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">أولياء الأمور</p>
                    <p className="text-2xl font-black text-gray-900">{usersByRole[Role.PARENT] || 0}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">حسابات متوقفة</p>
                    <p className="text-2xl font-black text-amber-600">{inactiveUsersCount}</p>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-4 shadow-sm lg:col-span-1">
                    <p className="text-xs text-indigo-700 font-bold mb-2">المعروض الآن</p>
                    <p className="text-2xl font-black text-indigo-900">{filteredUsers.length}</p>
                    <p className="text-xs text-indigo-600 mt-1">نشط: {visibleActiveCount} • موقوف: {visibleInactiveCount}</p>
                </div>
            </div>

            {isCreateOpen && (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">إضافة مستخدم جديد</h2>
                            <p className="text-sm text-gray-500 mt-1">إنشاء حساب حقيقي مع ضبط الدور والنطاق من البداية.</p>
                        </div>
                        <button
                            onClick={() => {
                                setIsCreateOpen(false);
                                setCreateError('');
                            }}
                            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">الاسم</label>
                            <input
                                type="text"
                                value={newUser.name}
                                onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="اسم المستخدم"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">البريد الإلكتروني</label>
                            <input
                                type="email"
                                value={newUser.email}
                                onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="name@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">كلمة المرور</label>
                            <input
                                type="password"
                                value={newUser.password}
                                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="******"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">الدور</label>
                            <select
                                value={newUser.role}
                                onChange={(event) =>
                                    setNewUser((current) => ({
                                        ...current,
                                        role: event.target.value as Role,
                                        linkedStudentIds: event.target.value === Role.PARENT ? current.linkedStudentIds : [],
                                        managedPathIds: event.target.value === Role.TEACHER ? current.managedPathIds : [],
                                        managedSubjectIds: event.target.value === Role.TEACHER ? current.managedSubjectIds : [],
                                    }))
                                }
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                            >
                                <option value={Role.STUDENT}>طالب</option>
                                <option value={Role.TEACHER}>معلم</option>
                                <option value={Role.SUPERVISOR}>مشرف</option>
                                <option value={Role.PARENT}>ولي أمر</option>
                                <option value={Role.ADMIN}>مدير</option>
                            </select>
                        </div>
                    </div>

                    {newUser.role === Role.TEACHER && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">المسارات المسندة</label>
                                <MultiSelectField
                                    value={newUser.managedPathIds}
                                    options={pathOptions}
                                    placeholder="أضف المسارات المتاحة للمعلم"
                                    onChange={(nextPathIds) =>
                                        setNewUser((current) => ({
                                            ...current,
                                            managedPathIds: nextPathIds,
                                            managedSubjectIds: current.managedSubjectIds.filter((subjectId) => {
                                                const subject = subjects.find((item) => item.id === subjectId);
                                                return subject && nextPathIds.includes(subject.pathId);
                                            }),
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">المواد المسندة</label>
                                <MultiSelectField
                                    value={newUser.managedSubjectIds}
                                    options={teacherSubjectOptions}
                                    placeholder="اختر المواد التابعة للمسارات"
                                    onChange={(nextSubjectIds) => setNewUser((current) => ({ ...current, managedSubjectIds: nextSubjectIds }))}
                                />
                            </div>
                        </div>
                    )}

                    {newUser.role === Role.PARENT && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">الأبناء المرتبطون</label>
                            <MultiSelectField
                                value={newUser.linkedStudentIds}
                                options={students.map((student) => ({ value: student.id, label: student.name }))}
                                placeholder="اختر الطلاب المرتبطين بولي الأمر"
                                onChange={(linkedStudentIds) => setNewUser((current) => ({ ...current, linkedStudentIds }))}
                            />
                        </div>
                    )}

                    {createError && (
                        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
                            {createError}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateUser}
                            disabled={isSubmitting}
                            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-5 py-2 rounded-lg transition-colors shadow-sm"
                        >
                            {isSubmitting ? 'جارٍ الإنشاء...' : 'حفظ المستخدم'}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                        className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-400" />
                    <select
                        className="border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        value={roleFilter}
                        onChange={(event) => setRoleFilter(event.target.value as Role | 'all')}
                    >
                        <option value="all">جميع الأدوار</option>
                        <option value={Role.ADMIN}>مدير</option>
                        <option value={Role.SUPERVISOR}>مشرف</option>
                        <option value={Role.TEACHER}>معلم</option>
                        <option value={Role.PARENT}>ولي أمر</option>
                        <option value={Role.STUDENT}>طالب</option>
                    </select>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setFilteredUsersStatus(true)}
                            disabled={manageableFilteredUsers.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                            <UserCheck size={14} />
                            تنشيط الكل
                        </button>
                        <button
                            onClick={() => setFilteredUsersStatus(false)}
                            disabled={manageableFilteredUsers.length === 0}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                            <UserX size={14} />
                            إيقاف الكل
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700">المستخدم</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700">الدور</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700">النطاق / الارتباط</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700">الحالة</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-700">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((currentUser) => {
                                const isEditing = editingUserId === currentUser.id;
                                const currentSchoolId = currentUser.schoolId || '';
                                const availableClasses = classes.filter((group) => !currentSchoolId || group.parentId === currentSchoolId);
                                const currentClassId = classes.find((group) => currentUser.groupIds?.includes(group.id))?.id || '';
                                const currentSupervisorGroupIds = currentUser.groupIds || [];
                                const parentCandidates = students.filter((student) => !currentSchoolId || student.schoolId === currentSchoolId);

                                return (
                                    <tr key={currentUser.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                                <div>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={nameDrafts[currentUser.id] ?? currentUser.name}
                                                            onChange={(event) =>
                                                                setNameDrafts((current) => ({
                                                                    ...current,
                                                                    [currentUser.id]: event.target.value,
                                                                }))
                                                            }
                                                            onBlur={() => saveUserName(currentUser)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter') {
                                                                    stopEditingUser(currentUser);
                                                                }
                                                            }}
                                                            className="w-full min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                        />
                                                    ) : (
                                                        <p className="font-bold text-gray-900">{currentUser.name}</p>
                                                    )}
                                                    <p className="text-xs text-gray-500">{currentUser.email || 'لا يوجد بريد'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing ? (
                                                <select
                                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                    value={currentUser.role}
                                                    onChange={(event) => handleRoleChange(currentUser.id, event.target.value as Role)}
                                                >
                                                    {Object.values(Role).map((role) => (
                                                        <option key={role} value={role}>
                                                            {roleLabels[role]}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                getRoleBadge(currentUser.role)
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {isEditing && currentUser.role === Role.STUDENT ? (
                                                <div className="space-y-2 min-w-[220px]">
                                                    <select
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        value={currentSchoolId}
                                                        onChange={(event) => handleStudentSchoolChange(currentUser, event.target.value)}
                                                    >
                                                        <option value="">بدون مدرسة</option>
                                                        {schools.map((school) => (
                                                            <option key={school.id} value={school.id}>{school.name}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        value={currentClassId}
                                                        onChange={(event) => handleStudentClassChange(currentUser, event.target.value)}
                                                    >
                                                        <option value="">بدون فصل</option>
                                                        {availableClasses.map((group) => (
                                                            <option key={group.id} value={group.id}>{group.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : isEditing && currentUser.role === Role.SUPERVISOR ? (
                                                <div className="space-y-2 min-w-[260px]">
                                                    <MultiSelectField
                                                        value={currentSupervisorGroupIds}
                                                        options={[...schools, ...classes].map((group) => ({
                                                            value: group.id,
                                                            label: `${group.type === 'SCHOOL' ? 'مدرسة' : 'فصل'} - ${group.name}`,
                                                        }))}
                                                        placeholder="اختر مدرسة أو فصلًا أو أكثر"
                                                        onChange={(nextGroupIds) => handleSupervisorGroupsChange(currentUser, nextGroupIds)}
                                                        size="sm"
                                                    />
                                                    <p className="text-[11px] text-gray-400">
                                                        يمكن جعل المشرف مدير مدرسة باختيار المدرسة، أو مسؤولًا عن فصل/عدة فصول من نفس الحساب.
                                                    </p>
                                                </div>
                                            ) : isEditing && currentUser.role === Role.PARENT ? (
                                                <div className="space-y-2 min-w-[240px]">
                                                    <select
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        value={currentSchoolId}
                                                        onChange={(event) => handleParentSchoolChange(currentUser, event.target.value)}
                                                    >
                                                        <option value="">بدون مدرسة</option>
                                                        {schools.map((school) => (
                                                            <option key={school.id} value={school.id}>{school.name}</option>
                                                        ))}
                                                    </select>
                                                    <MultiSelectField
                                                        value={currentUser.linkedStudentIds || []}
                                                        options={parentCandidates.map((student) => ({ value: student.id, label: student.name }))}
                                                        placeholder="اختر الأبناء المرتبطين"
                                                        onChange={(linkedStudentIds) => handleParentLinkedStudentsChange(currentUser.id, linkedStudentIds)}
                                                        size="sm"
                                                    />
                                                    <p className="text-[11px] text-gray-400">
                                                        يطّلع ولي الأمر على مهارات الضعف والتقدم لهؤلاء الأبناء فقط.
                                                    </p>
                                                </div>
                                            ) : isEditing && currentUser.role === Role.TEACHER ? (
                                                renderTeacherScopeEditor(currentUser)
                                            ) : (
                                                renderAssignmentSummary(currentUser)
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleUserStatus(currentUser.id)}
                                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                                                    currentUser.isActive
                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                }`}
                                            >
                                                {currentUser.isActive ? <UserCheck size={14} /> : <UserX size={14} />}
                                                {currentUser.isActive ? 'نشط' : 'موقوف'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => (isEditing ? stopEditingUser(currentUser) : startEditingUser(currentUser))}
                                                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="تعديل"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                    <MoreVertical size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            لا يوجد مستخدمون يطابقون بحثك.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UsersManager;
