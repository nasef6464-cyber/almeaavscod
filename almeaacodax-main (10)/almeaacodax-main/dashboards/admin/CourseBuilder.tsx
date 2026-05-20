import React, { useState } from 'react';
import { Course, Module, Lesson, LessonType } from '../../types';
import { RichTextEditor } from '../../components/RichTextEditor';
import { UnifiedLessonBuilder } from './builders/UnifiedLessonBuilder';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useStore } from '../../store/useStore';
import { sanitizeArabicText } from '../../utils/sanitizeMojibakeArabic';
import { Plus, GripVertical, Trash2, Edit2, Video, FileText, HelpCircle, File, Settings, BookOpen, Info, Save, X } from 'lucide-react';

const SortableDraggable = Draggable as any;

interface CourseBuilderProps {
  initialCourse?: Course;
  onSave: (course: Partial<Course>) => void;
  onCancel: () => void;
}

export const CourseBuilder: React.FC<CourseBuilderProps> = ({ initialCourse, onSave, onCancel }) => {
  const { paths, subjects, sections, skills } = useStore();
  const [activeTab, setActiveTab] = useState<'basic' | 'curriculum' | 'settings'>('basic');
  const [editingLesson, setEditingLesson] = useState<{moduleId: string, lesson: Lesson} | null>(null);
  
  // Initialize state with either existing course or empty defaults
  const [courseData, setCourseData] = useState<Partial<Course>>(initialCourse || {
    title: '',
    description: '',
    category: 'القدرات',
    level: 'Beginner',
    price: 0,
    currency: 'SAR',
    duration: 0,
    instructor: '',
    thumbnail: '',
    modules: [],
    isPublished: false,
    fakeRating: 5.0,
    fakeStudentsCount: 0,
  });
  const selectedPathId = (courseData.pathId || '') as string;
  const selectedSubjectId = (courseData.subjectId || courseData.subject || '') as string;
  const availableSubjects = subjects.filter((subject) => !selectedPathId || subject.pathId === selectedPathId);
  const visibleSubjectsForSkills = subjects.filter((subject) => {
    if (selectedSubjectId) return subject.id === selectedSubjectId;
    if (selectedPathId) return subject.pathId === selectedPathId;
    return true;
  });
  const getSafeLabel = (value: unknown, fallback: string) => {
    const text = sanitizeArabicText(String(value || '')).trim();
    if (!text) return fallback;
    if (/^\?+$/.test(text)) return fallback;
    return text;
  };

  const handleBasicChange = (field: keyof Course, value: any) => {
    setCourseData(prev => ({ ...prev, [field]: value }));
  };

  const buildSanitizedCoursePayload = () => {
    const selectedSkills = (courseData.skills || []) as string[];
    if (!selectedSkills.length) {
      return courseData;
    }

    const selectedSubjectSet = new Set(
      visibleSubjectsForSkills.map((subject) => String(subject.id)),
    );
    const allowedSkillIds = new Set(
      skills
        .filter((skill) => selectedSubjectSet.size === 0 || selectedSubjectSet.has(String(skill.subjectId)))
        .map((skill) => String(skill.id)),
    );
    const sanitizedSkills = selectedSkills.filter((skillId) => allowedSkillIds.has(String(skillId)));

    return {
      ...courseData,
      skills: sanitizedSkills,
    };
  };

  const handleSaveLesson = (moduleId: string, updatedLesson: Lesson) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => 
        m.id === moduleId 
          ? { ...m, lessons: m.lessons.map(l => l.id === updatedLesson.id ? updatedLesson : l) }
          : m
      )
    }));
    setEditingLesson(null);
  };

  // --- Curriculum Management ---
  const addModule = () => {
    const newModule: Module = {
      id: `mod_${Date.now()}`,
      title: 'وحدة جديدة',
      order: (courseData.modules?.length || 0) + 1,
      lessons: []
    };
    setCourseData(prev => ({ ...prev, modules: [...(prev.modules || []), newModule] }));
  };

  const updateModuleTitle = (moduleId: string, title: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => m.id === moduleId ? { ...m, title } : m)
    }));
  };

  const deleteModule = (moduleId: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الوحدة؟')) {
      setCourseData(prev => ({
        ...prev,
        modules: prev.modules?.filter(m => m.id !== moduleId)
      }));
    }
  };

  const addLesson = (moduleId: string, type: LessonType) => {
    const module = courseData.modules?.find(m => m.id === moduleId);
    if (!module) return;

    const newLesson: Lesson = {
      id: `les_${Date.now()}`,
      title: 'درس جديد',
      type,
      duration: '0 دقيقة',
      isCompleted: false,
      order: module.lessons.length + 1,
      skillIds: []
    };

    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => 
        m.id === moduleId ? { ...m, lessons: [...m.lessons, newLesson] } : m
      )
    }));
  };

  const deleteLesson = (moduleId: string, lessonId: string) => {
    setCourseData(prev => ({
      ...prev,
      modules: prev.modules?.map(m => 
        m.id === moduleId 
          ? { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) } 
          : m
      )
    }));
  };

  // Drag and drop handler
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    // Reordering modules
    if (type === 'module') {
      const newModules = Array.from(courseData.modules || []);
      const [reorderedItem] = newModules.splice(source.index, 1);
      newModules.splice(destination.index, 0, reorderedItem);
      
      // Update order property
      const updatedModules = newModules.map((m, index) => ({ ...(m as Module), order: index + 1 }));
      setCourseData(prev => ({ ...prev, modules: updatedModules }));
      return;
    }

    // Reordering lessons within the SAME module
    if (type === 'lesson' && source.droppableId === destination.droppableId) {
      const moduleId = source.droppableId;
      const moduleIndex = courseData.modules?.findIndex(m => m.id === moduleId);
      if (moduleIndex === undefined || moduleIndex === -1) return;

      const newModules = [...(courseData.modules || [])];
      const newLessons = Array.from(newModules[moduleIndex].lessons);
      const [reorderedItem] = newLessons.splice(source.index, 1);
      newLessons.splice(destination.index, 0, reorderedItem);

      // Update order property
      const updatedLessons = newLessons.map((l, index) => ({ ...(l as Lesson), order: index + 1 }));
      newModules[moduleIndex] = { ...newModules[moduleIndex], lessons: updatedLessons };

      setCourseData(prev => ({ ...prev, modules: newModules }));
    }
  };

  const getLessonIcon = (type: LessonType) => {
    switch (type) {
      case 'video': return <Video size={16} className="text-blue-500" />;
      case 'text': return <FileText size={16} className="text-emerald-500" />;
      case 'quiz': return <HelpCircle size={16} className="text-purple-500" />;
      case 'assignment': return <FileText size={16} className="text-orange-500" />;
      case 'file': return <File size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">
            {initialCourse ? 'تعديل الدورة' : 'إنشاء دورة جديدة'}
          </h2>
        </div>
        <button 
          onClick={() => onSave(buildSanitizedCoursePayload())}
          className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Save size={18} />
          حفظ الدورة
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-6">
        <button
          onClick={() => setActiveTab('basic')}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'basic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Info size={18} />
          المعلومات الأساسية
        </button>
        <button
          onClick={() => setActiveTab('curriculum')}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'curriculum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={18} />
          المنهج والدروس
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings size={18} />
          الإعدادات المتقدمة
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          
          {/* TAB: BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الدورة</label>
                  <input 
                    type="text" 
                    value={courseData.title || ''} 
                    onChange={(e) => handleBasicChange('title', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="مثال: التأسيس الشامل في القدرات الكمي"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">القسم / المسار</label>
                    <select 
                      value={courseData.category || 'القدرات'} 
                      onChange={(e) => handleBasicChange('category', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="القدرات">القدرات</option>
                      <option value="التحصيلي">التحصيلي</option>
                      <option value="الرخصة المهنية">الرخصة المهنية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المستوى</label>
                    <select 
                      value={courseData.level || 'Beginner'} 
                      onChange={(e) => handleBasicChange('level', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="Beginner">مبتدئ (تأسيس)</option>
                      <option value="Intermediate">متوسط (تدريب)</option>
                      <option value="Advanced">متقدم (مكثف)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المسار</label>
                    <select
                      value={selectedPathId}
                      onChange={(e) => {
                        const nextPathId = e.target.value;
                        const nextSubjectId = availableSubjects.some((subject) => subject.id === selectedSubjectId && subject.pathId === nextPathId)
                          ? selectedSubjectId
                          : '';
                        setCourseData((prev) => ({
                          ...prev,
                          pathId: nextPathId || undefined,
                          subjectId: nextSubjectId || undefined,
                          subject: nextSubjectId || '',
                          skills: [],
                        }));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">بدون مسار محدد</option>
                      {paths.map((path) => (
                        <option key={path.id} value={path.id}>{path.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المادة</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        const nextSubjectId = e.target.value;
                        setCourseData((prev) => ({
                          ...prev,
                          subjectId: nextSubjectId || undefined,
                          subject: nextSubjectId || '',
                          skills: [],
                        }));
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">بدون مادة محددة</option>
                      {availableSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{getSafeLabel(subject.name, 'مادة بدون اسم')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">السعر</label>
                    <input 
                      type="number" 
                      value={courseData.price || 0} 
                      onChange={(e) => handleBasicChange('price', Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">مهارات الدورة من مركز المهارات (اختياري)</label>
                    <select 
                      multiple
                      value={courseData.skills || []}
                      onChange={(e) => {
                        const values = Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value);
                        handleBasicChange('skills', values);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32"
                    >
                      {visibleSubjectsForSkills.map(subject => {
                        const subjectSections = sections.filter(section => section.subjectId === subject.id);
                        const subjectSkills = skills.filter(skill => skill.subjectId === subject.id);
                        if (subjectSections.length === 0 && subjectSkills.length === 0) return null;

                        return (
                          <optgroup key={subject.id} label={getSafeLabel(subject.name, 'مادة بدون اسم')}>
                            {subjectSections.map(mainSection => {
                              const subSkills = subjectSkills.filter(skill => skill.sectionId === mainSection.id);
                              return (
                                <React.Fragment key={mainSection.id}>
                                  <option disabled>{getSafeLabel(mainSection.name, 'قسم بدون اسم')}</option>
                                  {subSkills.map(subSkill => (
                                    <option key={subSkill.id} value={subSkill.id}>- {subSkill.name}</option>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                            {subjectSkills.filter(skill => !skill.sectionId).map(skill => (
                              <option key={skill.id} value={skill.id}>{getSafeLabel(skill.name, 'مهارة بدون اسم')}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">هذه المهارات تستخدم في التحليل والتوصيات، ولا تختلط بموضوعات التأسيس.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">الصورة المصغرة (Thumbnail)</label>
                  <div className="flex items-center gap-4">
                    {courseData.thumbnail && (
                      <img src={courseData.thumbnail} alt="Thumbnail" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              handleBasicChange('thumbnail', reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">أو أدخل رابط الصورة مباشرة:</p>
                      <input 
                        type="text" 
                        value={courseData.thumbnail || ''} 
                        onChange={(e) => handleBasicChange('thumbnail', e.target.value)}
                        className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">وصف الدورة (يدعم اللصق من PDF والرياضيات)</label>
                  <RichTextEditor 
                    value={courseData.description || ''} 
                    onChange={(val) => handleBasicChange('description', val)} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: CURRICULUM */}
          {activeTab === 'curriculum' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">منشئ المنهج (Curriculum Builder)</h3>
                <button 
                  onClick={addModule}
                  className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  إضافة وحدة جديدة
                </button>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="course-modules" type="module">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                      {courseData.modules?.map((module, index) => (
                        <SortableDraggable key={module.id} draggableId={module.id} index={index}>
                          {(provided) => (
                            <div 
                              ref={provided.innerRef} 
                              {...provided.draggableProps} 
                              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                            >
                              {/* Module Header */}
                              <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600">
                                  <GripVertical size={20} />
                                </div>
                                <div className="flex-1">
                                  <input 
                                    type="text" 
                                    value={module.title}
                                    onChange={(e) => updateModuleTitle(module.id, e.target.value)}
                                    className="bg-transparent font-bold text-gray-800 focus:outline-none focus:border-b-2 focus:border-indigo-500 w-full"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => deleteModule(module.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              {/* Lessons List */}
                              <Droppable droppableId={module.id} type="lesson">
                                {(provided) => (
                                  <div {...provided.droppableProps} ref={provided.innerRef} className="p-4 space-y-2 min-h-[50px]">
                                    {module.lessons.map((lesson, lessonIndex) => (
                                      <SortableDraggable key={lesson.id} draggableId={lesson.id} index={lessonIndex}>
                                        {(provided) => (
                                          <div 
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            className="flex items-center gap-3 bg-white border border-gray-100 p-3 rounded-lg hover:shadow-sm transition-shadow group"
                                          >
                                            <div {...provided.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500">
                                              <GripVertical size={16} />
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                                              {getLessonIcon(lesson.type)}
                                            </div>
                                            <div className="flex-1">
                                              <span className="font-medium text-gray-800 text-sm">{lesson.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button onClick={() => setEditingLesson({ moduleId: module.id, lesson })} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                                                <Edit2 size={14} />
                                              </button>
                                              <button onClick={() => deleteLesson(module.id, lesson.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </SortableDraggable>
                                    ))}
                                    {provided.placeholder}
                                    
                                    {/* Add Lesson Buttons */}
                                    <div className="pt-2 flex gap-2 flex-wrap">
                                      <button onClick={() => addLesson(module.id, 'video')} className="text-xs font-bold text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <Video size={14} /> فيديو
                                      </button>
                                      <button onClick={() => addLesson(module.id, 'text')} className="text-xs font-bold text-gray-500 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <FileText size={14} /> مقال/نص
                                      </button>
                                      <button onClick={() => addLesson(module.id, 'quiz')} className="text-xs font-bold text-gray-500 hover:text-purple-600 bg-gray-50 hover:bg-purple-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <HelpCircle size={14} /> اختبار
                                      </button>
                                      <button onClick={() => addLesson(module.id, 'assignment')} className="text-xs font-bold text-gray-500 hover:text-orange-600 bg-gray-50 hover:bg-orange-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                        <FileText size={14} /> واجب
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Droppable>
                            </div>
                          )}
                        </SortableDraggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              
              {courseData.modules?.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                  <p className="text-gray-500 mb-4">لا يوجد وحدات في هذه الدورة حتى الآن.</p>
                  <button onClick={addModule} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors inline-flex items-center gap-2">
                    <Plus size={18} />
                    إضافة الوحدة الأولى
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">إعدادات العرض (البيانات الوهمية - Fake Data)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">عدد الطلاب الوهمي</label>
                      <input 
                        type="number" 
                        value={courseData.fakeStudentsCount || 0} 
                        onChange={(e) => handleBasicChange('fakeStudentsCount', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">سيظهر هذا العدد للزوار كعدد الطلاب المسجلين.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">التقييم الوهمي (من 5)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        max="5"
                        min="1"
                        value={courseData.fakeRating || 5} 
                        onChange={(e) => handleBasicChange('fakeRating', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">إعدادات متقدمة</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input 
                        type="checkbox" 
                        checked={courseData.isPublished}
                        onChange={(e) => handleBasicChange('isPublished', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block font-bold text-gray-800">نشر الدورة</span>
                        <span className="text-xs text-gray-500">جعل الدورة مرئية للطلاب في المنصة.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input 
                        type="checkbox" 
                        checked={courseData.dripContentEnabled}
                        onChange={(e) => handleBasicChange('dripContentEnabled', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block font-bold text-gray-800">التقطير الزمني (Drip Content)</span>
                        <span className="text-xs text-gray-500">فتح الدروس تدريجياً للطلاب بناءً على جدول زمني.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input 
                        type="checkbox" 
                        checked={courseData.certificateEnabled}
                        onChange={(e) => handleBasicChange('certificateEnabled', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <span className="block font-bold text-gray-800">شهادة إتمام</span>
                        <span className="text-xs text-gray-500">منح الطالب شهادة عند إكمال جميع متطلبات الدورة.</span>
                      </div>
                    </label>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* Lesson Edit Modal */}
      {editingLesson && (
        <UnifiedLessonBuilder 
          initialLesson={editingLesson.lesson}
          moduleId={editingLesson.moduleId}
          onSave={handleSaveLesson}
          onCancel={() => setEditingLesson(null)}
        />
      )}
    </div>
  );
};

