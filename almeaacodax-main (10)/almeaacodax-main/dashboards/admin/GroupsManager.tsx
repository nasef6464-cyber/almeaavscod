import React, { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Group, GroupType, Role } from '../../types';
import { Building2, Users, BookOpen, Plus, Search, MoreVertical, Edit2, Trash2, UserCheck, UserMinus, Shield, Download, FileSpreadsheet } from 'lucide-react';
import { loadXlsx } from '../../utils/xlsxLoader';

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

export const GroupsManager: React.FC = () => {
    const { 
        groups, 
        users, 
        courses,
        createGroup, 
        updateGroup, 
        deleteGroup, 
        assignStudentToGroup, 
        removeStudentFromGroup,
        assignSupervisorToGroup,
        removeSupervisorFromGroup,
        assignCourseToGroup,
        removeCourseFromGroup,
    } = useStore();

    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<GroupType | 'ALL'>('ALL');
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [isEditingGroup, setIsEditingGroup] = useState(false);
    const [groupDraft, setGroupDraft] = useState<{ name: string; type: GroupType; parentId?: string }>({
        name: '',
        type: 'CLASS',
        parentId: '',
    });

    const filteredGroups = groups.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || g.type === typeFilter;
        return matchesSearch && matchesType;
    });
    const schools = groups.filter(group => group.type === 'SCHOOL');
    const publishedCourses = courses.filter(course => course.isPublished !== false);
    const classes = groups.filter(group => group.type === 'CLASS');
    const privateGroups = groups.filter(group => group.type === 'PRIVATE_GROUP');
    const totalLinkedStudents = groups.reduce((sum, group) => sum + group.studentIds.length, 0);
    const totalLinkedSupervisors = groups.reduce((sum, group) => sum + group.supervisorIds.length, 0);
    const groupsWithoutSupervisor = groups.filter(group => group.supervisorIds.length === 0).length;
    const groupsWithoutContent = groups.filter(group => group.courseIds.length === 0).length;
    const readinessIssues = useMemo(() => {
        return groups
            .map((group) => {
                const issues: string[] = [];
                if (group.supervisorIds.length === 0) issues.push('بدون مشرف');
                if (group.courseIds.length === 0) issues.push('بدون محتوى');
                if (group.type !== 'SCHOOL' && group.studentIds.length === 0) issues.push('بدون طلاب');
                return {
                    group,
                    issues,
                };
            })
            .filter((item) => item.issues.length > 0);
    }, [groups]);

    const getTypeBadge = (type: GroupType) => {
        switch (type) {
            case 'SCHOOL': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">مدرسة</span>;
            case 'CLASS': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">فصل</span>;
            case 'PRIVATE_GROUP': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">مجموعة خاصة</span>;
            default: return null;
        }
    };

    const handleCreateGroup = () => {
        const currentUser = useStore.getState().user;
        const newGroup: Group = {
            id: `g_${Date.now()}`,
            name: 'مجموعة جديدة',
            type: 'CLASS',
            ownerId: currentUser?.id || 'admin',
            supervisorIds: [],
            studentIds: [],
            courseIds: [],
            createdAt: Date.now(),
            totalStudents: 0,
            totalSupervisors: 0,
            totalCourses: 0
        };
        createGroup(newGroup);
        setSelectedGroup(newGroup);
        setGroupDraft({ name: newGroup.name, type: newGroup.type, parentId: newGroup.parentId || '' });
        setIsEditingGroup(true);
    };

    const openGroupDetails = (group: Group) => {
        setSelectedGroup(group);
        setGroupDraft({ name: group.name, type: group.type, parentId: group.parentId || '' });
        setIsEditingGroup(false);
    };

    const saveSelectedGroup = () => {
        if (!selectedGroup) return;

        const nextName = groupDraft.name.trim();
        if (!nextName) return;

        const updatedGroup = {
            ...selectedGroup,
            name: nextName,
            type: groupDraft.type,
            parentId: groupDraft.type === 'CLASS' ? groupDraft.parentId || undefined : undefined,
        };

        updateGroup(selectedGroup.id, {
            name: updatedGroup.name,
            type: updatedGroup.type,
            parentId: updatedGroup.parentId,
        });
        setSelectedGroup(updatedGroup);
        setIsEditingGroup(false);
    };

    const exportGroupsWorkbook = () => {
        const groupRows: Array<Array<string | number>> = [
            ['الاسم', 'النوع', 'المدرسة الأم', 'الطلاب', 'المشرفون', 'الدورات', 'تاريخ الإنشاء', 'ملاحظة تشغيلية'],
            ...filteredGroups.map((group) => {
                const parentSchool = group.parentId ? schools.find((school) => school.id === group.parentId) : undefined;
                const note = [
                    group.supervisorIds.length === 0 ? 'يحتاج مشرف' : '',
                    group.courseIds.length === 0 ? 'لا توجد دورات مرتبطة' : '',
                ].filter(Boolean).join(' - ') || 'جاهز مبدئيًا';

                return [
                    group.name,
                    group.type === 'SCHOOL' ? 'مدرسة' : group.type === 'CLASS' ? 'فصل' : 'مجموعة خاصة',
                    parentSchool?.name || '',
                    group.studentIds.length,
                    group.supervisorIds.length,
                    group.courseIds.length,
                    new Date(group.createdAt).toLocaleDateString('ar-SA'),
                    note,
                ];
            }),
        ];

        const studentRows: Array<Array<string | number>> = [
            ['الطالب', 'البريد الإلكتروني', 'المجموعة/الفصل', 'النوع', 'المدرسة الأم'],
        ];

        filteredGroups.forEach((group) => {
            const parentSchool = group.parentId ? schools.find((school) => school.id === group.parentId) : undefined;
            users
                .filter((user) => group.studentIds.includes(user.id))
                .forEach((student) => {
                    studentRows.push([
                        student.name,
                        student.email || '',
                        group.name,
                        group.type === 'SCHOOL' ? 'مدرسة' : group.type === 'CLASS' ? 'فصل' : 'مجموعة خاصة',
                        parentSchool?.name || '',
                    ]);
                });
        });

        const supervisorRows: Array<Array<string | number>> = [
            ['المشرف/المعلم', 'البريد الإلكتروني', 'الدور', 'المجموعة/الفصل', 'المدرسة الأم'],
        ];

        filteredGroups.forEach((group) => {
            const parentSchool = group.parentId ? schools.find((school) => school.id === group.parentId) : undefined;
            users
                .filter((user) => group.supervisorIds.includes(user.id))
                .forEach((supervisor) => {
                    supervisorRows.push([
                        supervisor.name,
                        supervisor.email || '',
                        supervisor.role === Role.TEACHER ? 'معلم' : 'مشرف',
                        group.name,
                        parentSchool?.name || '',
                    ]);
                });
        });

        createWorkbookDownload('school-groups-operational-report.xlsx', [
            { name: 'groups', rows: groupRows },
            { name: 'students', rows: studentRows },
            { name: 'supervisors', rows: supervisorRows },
        ]);
    };

    const exportReadinessIssuesWorkbook = () => {
        const rows: Array<Array<string | number>> = [
            ['المجموعة', 'النوع', 'المشكلات', 'عدد الطلاب', 'عدد المشرفين', 'عدد الدورات'],
            ...readinessIssues.map(({ group, issues }) => [
                group.name,
                group.type === 'SCHOOL' ? 'مدرسة' : group.type === 'CLASS' ? 'فصل' : 'مجموعة خاصة',
                issues.join(' - '),
                group.studentIds.length,
                group.supervisorIds.length,
                group.courseIds.length,
            ]),
        ];
        createWorkbookDownload('groups-readiness-issues.xlsx', [{ name: 'readiness-issues', rows }]);
    };

    const exportSelectedGroupRoster = (
        group: Group,
        groupStudents: typeof users,
        groupSupervisors: typeof users,
        groupCourses: typeof courses,
        parentSchool?: Group,
    ) => {
        createWorkbookDownload(`${group.name}-roster.xlsx`, [
            {
                name: 'summary',
                rows: [
                    ['اسم المجموعة', group.name],
                    ['النوع', group.type === 'SCHOOL' ? 'مدرسة' : group.type === 'CLASS' ? 'فصل' : 'مجموعة خاصة'],
                    ['المدرسة الأم', parentSchool?.name || ''],
                    ['عدد الطلاب', groupStudents.length],
                    ['عدد المشرفين والمعلمين', groupSupervisors.length],
                    ['عدد الدورات المرتبطة', groupCourses.length],
                    ['ملاحظة', group.supervisorIds.length === 0 ? 'يحتاج تعيين مشرف أو معلم' : 'جاهز للمتابعة'],
                ],
            },
            {
                name: 'students',
                rows: [
                    ['اسم الطالب', 'البريد الإلكتروني', 'الحالة'],
                    ...groupStudents.map((student) => [
                        student.name,
                        student.email || '',
                        student.isActive === false ? 'متوقف' : 'نشط',
                    ]),
                ],
            },
            {
                name: 'supervisors',
                rows: [
                    ['الاسم', 'البريد الإلكتروني', 'الدور', 'الحالة'],
                    ...groupSupervisors.map((supervisor) => [
                        supervisor.name,
                        supervisor.email || '',
                        supervisor.role === Role.TEACHER ? 'معلم' : 'مشرف',
                        supervisor.isActive === false ? 'متوقف' : 'نشط',
                    ]),
                ],
            },
            {
                name: 'courses',
                rows: [
                    ['الدورة', 'الحالة'],
                    ...groupCourses.map((course) => [
                        course.title,
                        course.isPublished === false ? 'غير منشورة' : 'منشورة',
                    ]),
                ],
            },
        ]);
    };

    if (selectedGroup) {
        // Detailed View
        const groupStudents = users.filter(u => selectedGroup.studentIds.includes(u.id));
        const groupSupervisors = users.filter(u => selectedGroup.supervisorIds.includes(u.id));
        const groupCourses = publishedCourses.filter(course => selectedGroup.courseIds.includes(course.id));
        const parentSchool = selectedGroup.parentId ? schools.find(school => school.id === selectedGroup.parentId) : undefined;
        
        const availableStudents = users.filter(u => u.role === Role.STUDENT && !selectedGroup.studentIds.includes(u.id));
        const availableSupervisors = users.filter(u => (u.role === Role.SUPERVISOR || u.role === Role.TEACHER) && !selectedGroup.supervisorIds.includes(u.id));
        const availableCourses = publishedCourses.filter(course => !selectedGroup.courseIds.includes(course.id));

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setSelectedGroup(null); setIsEditingGroup(false); }} className="text-gray-500 hover:text-gray-900">
                        &rarr; عودة للقائمة
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">تفاصيل المجموعة</h1>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            {isEditingGroup ? (
                                <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto] gap-3 mb-3">
                                    <input
                                        type="text"
                                        value={groupDraft.name}
                                        onChange={(event) => setGroupDraft((current) => ({ ...current, name: event.target.value }))}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                saveSelectedGroup();
                                            }
                                        }}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                    <select
                                        value={groupDraft.type}
                                        onChange={(event) => {
                                            const nextType = event.target.value as GroupType;
                                            setGroupDraft((current) => ({
                                                ...current,
                                                type: nextType,
                                                parentId: nextType === 'CLASS' ? current.parentId : '',
                                            }));
                                        }}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                                    >
                                        <option value="SCHOOL">مدرسة</option>
                                        <option value="CLASS">فصل</option>
                                        <option value="PRIVATE_GROUP">مجموعة خاصة</option>
                                    </select>
                                    <select
                                        value={groupDraft.parentId || ''}
                                        onChange={(event) => setGroupDraft((current) => ({ ...current, parentId: event.target.value }))}
                                        disabled={groupDraft.type !== 'CLASS'}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                                    >
                                        <option value="">بدون مدرسة أم</option>
                                        {schools
                                            .filter((school) => school.id !== selectedGroup.id)
                                            .map((school) => (
                                                <option key={school.id} value={school.id}>{school.name}</option>
                                            ))}
                                    </select>
                                    <button
                                        onClick={saveSelectedGroup}
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors"
                                    >
                                        حفظ
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-xl font-bold text-gray-900">{selectedGroup.name}</h2>
                                    {getTypeBadge(selectedGroup.type)}
                                </div>
                            )}
                            <p className="text-sm text-gray-500">تم الإنشاء: {new Date(selectedGroup.createdAt).toLocaleDateString('ar-SA')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => exportSelectedGroupRoster(selectedGroup, groupStudents, groupSupervisors, groupCourses, parentSchool)}
                                className="p-2 text-gray-500 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="تصدير كشف المجموعة"
                            >
                                <Download size={18} />
                            </button>
                            <button
                                onClick={() => {
                                    if (isEditingGroup) {
                                        saveSelectedGroup();
                                        return;
                                    }

                                    setGroupDraft({ name: selectedGroup.name, type: selectedGroup.type, parentId: selectedGroup.parentId || '' });
                                    setIsEditingGroup(true);
                                }}
                                className="p-2 text-gray-500 hover:text-amber-600 bg-gray-50 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                                <Edit2 size={18} />
                            </button>
                            <button 
                                onClick={() => {
                                    if(window.confirm('هل أنت متأكد من حذف هذه المجموعة؟')) {
                                        deleteGroup(selectedGroup.id);
                                        setSelectedGroup(null);
                                        setIsEditingGroup(false);
                                    }
                                }}
                                className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>

                    {parentSchool ? (
                        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                            المدرسة الأم: {parentSchool.name}
                        </div>
                    ) : null}

                    <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                        <div className="flex items-start gap-3">
                            <FileSpreadsheet className="text-amber-600 mt-0.5" size={20} />
                            <div>
                                <h3 className="font-bold text-gray-900">جاهزية تشغيل المجموعة</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    {selectedGroup.supervisorIds.length === 0
                                        ? 'هذه المجموعة تحتاج تعيين مشرف أو معلم حتى تكون المتابعة واضحة.'
                                        : selectedGroup.studentIds.length === 0
                                          ? 'أضف الطلاب لهذه المجموعة ثم صدّر الكشف للمراجعة.'
                                          : selectedGroup.courseIds.length === 0
                                            ? 'اربط دورة أو أكثر حتى يظهر المحتوى داخل نطاق الطلاب.'
                                            : 'المجموعة جاهزة مبدئيًا: طلاب + مشرفون + محتوى مرتبط.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-4">
                            <Users className="text-blue-500" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">الطلاب</p>
                                <p className="text-xl font-bold text-gray-900">{selectedGroup.studentIds.length}</p>
                            </div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg flex items-center gap-4">
                            <Shield className="text-purple-500" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">المشرفين</p>
                                <p className="text-xl font-bold text-gray-900">{selectedGroup.supervisorIds.length}</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg flex items-center gap-4">
                            <BookOpen className="text-amber-500" size={24} />
                            <div>
                                <p className="text-sm text-gray-500">الدورات</p>
                                <p className="text-xl font-bold text-gray-900">{selectedGroup.courseIds.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-xl p-5 mb-8 bg-gray-50/40">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                            <div>
                                <h3 className="font-bold text-gray-900">الدورات المرتبطة بالمجموعة</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    اربط الدورات المنشورة بالمدرسة أو الفصل أو المجموعة حتى تظهر ضمن نطاق الطلاب.
                                </p>
                            </div>
                            <select
                                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                onChange={(e) => {
                                    if (e.target.value) {
                                        assignCourseToGroup(e.target.value, selectedGroup.id);
                                        setSelectedGroup(useStore.getState().groups.find(g => g.id === selectedGroup.id) || null);
                                        e.target.value = '';
                                    }
                                }}
                                value=""
                            >
                                <option value="">+ إضافة دورة منشورة</option>
                                {availableCourses.map(course => (
                                    <option key={course.id} value={course.id}>{course.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {groupCourses.length === 0 ? (
                                <span className="text-sm text-gray-400">لا توجد دورات مرتبطة بهذه المجموعة حتى الآن.</span>
                            ) : groupCourses.map(course => (
                                <button
                                    key={course.id}
                                    onClick={() => {
                                        removeCourseFromGroup(course.id, selectedGroup.id);
                                        setSelectedGroup(useStore.getState().groups.find(g => g.id === selectedGroup.id) || null);
                                    }}
                                    className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
                                >
                                    {course.title} ×
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Students Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900">الطلاب المسجلين</h3>
                                <select 
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            assignStudentToGroup(e.target.value, selectedGroup.id);
                                            // Refresh local state view
                                            setSelectedGroup(useStore.getState().groups.find(g => g.id === selectedGroup.id) || null);
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="">+ إضافة طالب</option>
                                    {availableStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {groupStudents.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">لا يوجد طلاب</p>
                                ) : (
                                    groupStudents.map(student => (
                                        <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <img src={student.avatar} alt="" className="w-8 h-8 rounded-full" />
                                                <span className="text-sm font-medium">{student.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    removeStudentFromGroup(student.id, selectedGroup.id);
                                                    setSelectedGroup(useStore.getState().groups.find(g => g.id === selectedGroup.id) || null);
                                                }}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <UserMinus size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Supervisors Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900">المشرفين والمعلمين</h3>
                                <select 
                                    className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            assignSupervisorToGroup(e.target.value, selectedGroup.id);
                                            setSelectedGroup(useStore.getState().groups.find(g => g.id === selectedGroup.id) || null);
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="">+ إضافة مشرف</option>
                                    {availableSupervisors.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {groupSupervisors.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">لا يوجد مشرفين</p>
                                ) : (
                                    groupSupervisors.map(supervisor => (
                                        <div key={supervisor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <img src={supervisor.avatar} alt="" className="w-8 h-8 rounded-full" />
                                                <span className="text-sm font-medium">{supervisor.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    removeSupervisorFromGroup(supervisor.id, selectedGroup.id);
                                                    setSelectedGroup(useStore.getState().groups.find(g => g.id === selectedGroup.id) || null);
                                                }}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <UserMinus size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">المجموعات والمدارس</h1>
                    <p className="text-gray-500 text-sm mt-1">إدارة المدارس، الفصول، والمجموعات الخاصة</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={exportGroupsWorkbook}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Download size={18} />
                        <span>تصدير التشغيل</span>
                    </button>
                    <button
                        onClick={exportReadinessIssuesWorkbook}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={18} />
                        <span>تصدير نواقص الجاهزية</span>
                    </button>
                    <button 
                        onClick={handleCreateGroup}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        <span>إنشاء مجموعة</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">المدارس</p>
                    <p className="text-2xl font-black text-gray-900">{schools.length}</p>
                    <p className="text-xs text-gray-400 mt-1">{classes.length} فصل مرتبط</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">المجموعات الخاصة</p>
                    <p className="text-2xl font-black text-gray-900">{privateGroups.length}</p>
                    <p className="text-xs text-gray-400 mt-1">للخطط والتجميعات المرنة</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">طلاب داخل مجموعات</p>
                    <p className="text-2xl font-black text-gray-900">{totalLinkedStudents}</p>
                    <p className="text-xs text-gray-400 mt-1">{totalLinkedSupervisors} مشرف/معلم مرتبط</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">تنبيهات تشغيل</p>
                    <p className="text-2xl font-black text-amber-600">{groupsWithoutSupervisor + groupsWithoutContent}</p>
                    <p className="text-xs text-gray-400 mt-1">{groupsWithoutSupervisor} بلا مشرف، {groupsWithoutContent} بلا محتوى</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-2">نواقص الجاهزية</p>
                    <p className="text-2xl font-black text-rose-700">{readinessIssues.length}</p>
                    <p className="text-xs text-gray-400 mt-1">مجموعات تحتاج تدخل قبل التسليم</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="ابحث باسم المجموعة أو المدرسة..." 
                        className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-gray-400" />
                    <select 
                        className="border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as GroupType | 'ALL')}
                    >
                        <option value="ALL">جميع الأنواع</option>
                        <option value="SCHOOL">مدارس</option>
                        <option value="CLASS">فصول</option>
                        <option value="PRIVATE_GROUP">مجموعات خاصة</option>
                    </select>
                </div>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map(group => (
                    (() => {
                        const groupIssues = readinessIssues.find((item) => item.group.id === group.id)?.issues || [];
                        return (
                    <div 
                        key={group.id} 
                        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => openGroupDetails(group)}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg group-hover:text-amber-600 transition-colors">{group.name}</h3>
                                <div className="mt-2">{getTypeBadge(group.type)}</div>
                                {groupIssues.length ? (
                                    <div className="mt-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700 inline-flex">
                                        {groupIssues.join(' - ')}
                                    </div>
                                ) : (
                                    <div className="mt-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 inline-flex">
                                        جاهز تشغيليًا
                                    </div>
                                )}
                            </div>
                            <button className="text-gray-400 hover:text-gray-900">
                                <MoreVertical size={18} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-gray-50">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 mb-1">الطلاب</p>
                                <p className="font-bold text-gray-900">{group.studentIds.length}</p>
                            </div>
                            <div className="text-center border-r border-l border-gray-100">
                                <p className="text-xs text-gray-500 mb-1">المشرفين</p>
                                <p className="font-bold text-gray-900">{group.supervisorIds.length}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 mb-1">الدورات</p>
                                <p className="font-bold text-gray-900">{group.courseIds.length}</p>
                            </div>
                        </div>
                    </div>
                        );
                    })()
                ))}
                {filteredGroups.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100">
                        لا توجد مجموعات تطابق بحثك.
                    </div>
                )}
            </div>
        </div>
    );
};
