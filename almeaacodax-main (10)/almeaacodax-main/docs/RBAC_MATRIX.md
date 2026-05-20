# RBAC Matrix

| Feature | Super Admin | Admin | Supervisor | Teacher | Parent | Student |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manage Tenants (Schools)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Staff** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Students** | ✅ | ✅ | ✅ (Own Group) | ✅ (Own Class) | ❌ | ❌ |
| **Create Courses** | ✅ | ✅ | ❌ | ✅ (Draft) | ❌ | ❌ |
| **Publish Courses** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Reports** | ✅ | ✅ | ✅ (School) | ✅ (Class) | ✅ (Kids) | ✅ (Self) |
| **Take Quizzes** | ⚠️ (Test) | ⚠️ (Test) | ❌ | ❌ | ❌ | ✅ |
| **Billing/Finance** | ✅ | ✅ | ❌ | ❌ | ✅ (Own) | ❌ |
| **System Settings** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Special Permissions
- **Content Approval:** Required for Teacher-created courses.
- **Data Scope:**
  - `Super Admin`: Global scope.
  - `Supervisor`: Scoped to `schoolId`.
  - `Teacher`: Scoped to assigned `courses`/`groups`.
