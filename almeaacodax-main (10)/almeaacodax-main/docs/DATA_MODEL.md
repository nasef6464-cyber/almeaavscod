# Data Model (MongoDB)

## Collections

### 1. Users
- `_id`: ObjectId
- `name`: String
- `email`: String (Unique)
- `passwordHash`: String
- `role`: Enum ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'TEACHER', 'PARENT', 'STUDENT')
- `schoolId`: Ref(School) [Nullable]
- `groupId`: Ref(Group) [Nullable]
- `childrenIds`: [Ref(User)] (For Parents)
- `subscriptionStatus`: Enum ('FREE', 'ACTIVE', 'EXPIRED')
- `avatar`: String
- `createdAt`: Date

### 2. Schools (Tenants)
- `_id`: ObjectId
- `name`: String
- `code`: String (Unique)
- `logo`: String
- `subscriptionPlan`: String
- `settings`: Object (Theme colors, features enabled)

### 3. Groups (Classes/Batches)
- `_id`: ObjectId
- `name`: String
- `schoolId`: Ref(School)
- `supervisorId`: Ref(User)

### 4. Courses
- `_id`: ObjectId
- `title`: String
- `description`: String
- `category`: Enum ('Qudrat', 'Tahsili', 'General')
- `subject`: String (Math, Physics, etc.)
- `instructorId`: Ref(User)
- `syllabus`: Array (Modules -> Lessons)
- `price`: Number

### 5. Lessons
- `_id`: ObjectId
- `courseId`: Ref(Course)
- `title`: String
- `type`: Enum ('VIDEO', 'TEXT', 'QUIZ', 'LIVE')
- `contentUrl`: String
- `duration`: Number

### 6. QuestionBank
- `_id`: ObjectId
- `text`: String
- `type`: Enum ('MCQ', 'TRUE_FALSE')
- `options`: [{ text: String, isCorrect: Boolean }]
- `explanation`: String
- `difficulty`: Enum ('EASY', 'MEDIUM', 'HARD')
- `skills`: [String] (Tags)
- `subject`: String

### 7. Quizzes
- `_id`: ObjectId
- `title`: String
- `courseId`: Ref(Course) [Optional]
- `questions`: [Ref(QuestionBank)]
- `timeLimit`: Number (Minutes)
- `passingScore`: Number

### 8. Attempts (Results)
- `_id`: ObjectId
- `userId`: Ref(User)
- `quizId`: Ref(Quiz)
- `score`: Number
- `answers`: [{ questionId: ObjectId, selectedOption: Number }]
- `completedAt`: Date
- `skillAnalysis`: [{ skill: String, score: Number }]

### 9. Packages
- `_id`: ObjectId
- `name`: String
- `courses`: [Ref(Course)]
- `price`: Number
- `discount`: Number
