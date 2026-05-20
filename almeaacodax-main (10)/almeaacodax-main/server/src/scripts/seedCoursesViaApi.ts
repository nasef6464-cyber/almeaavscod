import { courses as mockCourses } from "../../../services/mockData.js";

const API_BASE_URL = "http://127.0.0.1:4000/api";

async function createCourse(course: any) {
  const response = await fetch(`${API_BASE_URL}/courses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(course),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create course ${course.id}: ${response.status} ${text}`);
  }

  return response.json();
}

async function seedCourses() {
  for (const course of mockCourses) {
    try {
      await createCourse(course);
      console.log(`Created course ${course.id}`);
    } catch (error) {
      console.error(String(error));
    }
  }
}

seedCourses().catch((error) => {
  console.error(error);
  process.exit(1);
});
