import { getSchoolClassroomContext } from "./school-store.mjs";
import { schoolClassroomsOperation } from "./classroom-store.mjs";

export async function schoolClassroomsRequest(principal, action, payload) {
  if (!["list", "create", "link", "details"].includes(action)) throw Object.assign(new Error("Classroom action not found."), { statusCode: 404 });
  return schoolClassroomsOperation(action, await getSchoolClassroomContext(principal, payload.schoolId), payload);
}
