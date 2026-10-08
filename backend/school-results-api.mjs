import { getSchoolReportingContext } from "./school-store.mjs";
import { schoolResultsOperation } from "./classroom-store.mjs";
import { sendSchoolResultEmail } from "./school-email.mjs";
import { draftSchoolReportComment } from "./school-report-comment.mjs";

export async function schoolResultsRequest(principal, action, payload, dependencies = {}) {
  const allowed = new Set(["list", "reports", "create", "update", "approve", "export", "send", "template", "template-update", "regenerate-comment"]);
  if (!allowed.has(action)) throw Object.assign(new Error("Results action not found."), { statusCode: 404 });
  const scope = await (dependencies.context ?? getSchoolReportingContext)(principal, payload.schoolId);
  const operation = dependencies.operation ?? schoolResultsOperation;
  const generateComment = dependencies.generateComment ?? draftSchoolReportComment;
  if (action === "create") {
    const created = await operation("create", scope, payload);
    const draft = await generateComment(created.report);
    return operation("set-generated-comment", scope, {
      reportId: created.report.reportId,
      comment: draft.comment,
      generatedBy: draft.generatedBy,
    });
  }
  if (action === "regenerate-comment") {
    const context = await operation("comment-context", scope, payload);
    const draft = await generateComment(context.report);
    return { ...draft };
  }
  if (action !== "send") return operation(action, scope, payload);
  // Persist the send intent before contacting the provider. A concurrent click
  // cannot send the same revision twice; uncertain outcomes stay locked.
  const { report } = await operation("begin-send", scope, payload);
  const delivery = await (dependencies.send ?? sendSchoolResultEmail)(report);
  return operation("finish-send", scope, { reportId: report.reportId, revision: report.revision, key: report.delivery.key, delivery });
}
