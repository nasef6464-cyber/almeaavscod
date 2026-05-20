import fs from "node:fs";

const root = process.cwd();
const routeFile = "server/src/routes/payment.routes.ts";
const source = fs.readFileSync(`${root}/${routeFile}`, "utf8");

const findPostRouteBlocks = () => {
  const postRoutes = [];
  let cursor = 0;

  while (true) {
    const start = source.indexOf("paymentRouter.post(", cursor);
    if (start < 0) break;

    const nextRoute = source.indexOf("\npaymentRouter.", start + 1);
    const block = source.substring(start, nextRoute >= 0 ? nextRoute : source.length);
    const header = block.slice(0, 220);

    const pathMatch = header.match(/paymentRouter\.post\(\s*([`'\"])(.*?)\1\s*,/s);
    if (pathMatch && pathMatch[2]) {
      postRoutes.push({
        path: pathMatch[2],
        block,
      });
    }

    cursor = (nextRoute >= 0 ? nextRoute : -1) + 1;
    if (cursor <= start) break;
  }

  return postRoutes;
};

const routeBlocks = findPostRouteBlocks();
const findRouteBlock = (path) => routeBlocks.find((entry) => entry.path === path)?.block || "";

const requestBlock = findRouteBlock("/requests");
const previewBlock = findRouteBlock("/discount-codes/preview");
const schemaStart = source.indexOf("const paymentRequestCreateSchema = z.object({");
const schemaEnd = source.indexOf("});", schemaStart);
const requestSchemaBlock = schemaStart >= 0 && schemaEnd > schemaStart ? source.slice(schemaStart, schemaEnd + 3) : "";

if (!requestBlock) {
  console.error("[FAIL] unable to locate paymentRouter.post(\"/requests\") block");
  process.exit(1);
}

if (!previewBlock) {
  console.error("[FAIL] unable to locate paymentRouter.post(\"/discount-codes/preview\") block");
  process.exit(1);
}

const checks = [];
const add = (name, fn) => checks.push({ name, fn });

add("uses trustedTarget resolver before amount calculation", () => {
  if (!requestBlock.includes("const trustedTarget = await buildTrustedPaymentTarget(payload);")) {
    throw new Error("Missing trusted target resolution in /requests");
  }
});

add("create schema does not accept client truth fields for amount/name/courses", () => {
  if (!requestSchemaBlock) {
    throw new Error("Unable to inspect paymentRequestCreateSchema");
  }
  if (requestSchemaBlock.includes("itemName:")) {
    throw new Error("itemName should not be accepted in payment request create schema");
  }
  if (requestSchemaBlock.includes("amount:")) {
    throw new Error("amount should not be accepted in payment request create schema");
  }
  if (requestSchemaBlock.includes("includedCourseIds:")) {
    throw new Error("includedCourseIds should not be accepted in payment request create schema");
  }
});

add("does not trust client amount when calculating final amount", () => {
  if (!/originalAmount\s*=\s*trustedTarget\.originalAmount/.test(requestBlock)) {
    throw new Error("Missing assignment originalAmount = trustedTarget.originalAmount");
  }

  if (/payload\.amount/.test(requestBlock)) {
    throw new Error("Potential trust of client amount directly in /requests payload");
  }
});

add("persists trusted metadata when creating payment request", () => {
  if (!requestBlock.includes('itemName: trustedTarget.itemName')) {
    throw new Error("Persisted itemName is not trusted");
  }
  if (!requestBlock.includes('packageId: trustedTarget.packageId || ""')) {
    throw new Error("Persisted packageId is not trusted");
  }
  if (!requestBlock.includes('includedCourseIds: trustedTarget.includedCourseIds || []')) {
    throw new Error("Persisted includedCourseIds is not trusted");
  }
  if (!requestBlock.includes("currency: trustedTarget.currency")) {
    throw new Error("Persisted currency is not trusted");
  }
  if (!requestBlock.includes("itemType: payload.itemType")) {
    throw new Error("itemType should stay explicit from payload validation");
  }
  if (!requestBlock.includes("itemId: payload.itemId")) {
    throw new Error("itemId should stay explicit from payload validation");
  }
  if (requestBlock.includes("itemName: payload.itemName")) {
    throw new Error("Still persisting untrusted client itemName");
  }
});

add("uses trusted target in ownership and discount checks", () => {
  if (!requestBlock.includes("packageId: trustedTarget.packageId || \"\"")) {
    throw new Error("Ownership check should use trusted packageId");
  }

  if (!requestBlock.includes("packageId: trustedTarget.packageId")) {
    throw new Error("Discount check should use trusted packageId");
  }
  if (!requestBlock.includes("includedCourseIds: trustedTarget.includedCourseIds || []")) {
    throw new Error("Discount/ownership should use trusted includedCourseIds");
  }
});

add("preview endpoint uses trusted resolver", () => {
  if (!previewBlock.includes("const resolvedTarget = await buildTrustedPaymentTarget(trustedRequestPayload);")) {
    throw new Error("Missing trusted resolver in /discount-codes/preview");
  }
});

add("preview endpoint derives original amount from trusted target", () => {
  if (!previewBlock.includes("const originalAmount = resolvedTarget.ok ? resolvedTarget.originalAmount : 0;")) {
    throw new Error("Preview endpoint should use trusted originalAmount");
  }

  if (previewBlock.includes("itemName: payload.itemName")) {
    throw new Error("Preview route should not persist or trust itemName from client");
  }
});

add("approval flow grants access from stored server-verified request only", () => {
  if (!source.includes("const access = await grantApprovedPaymentAccess(approved.request")) {
    throw new Error("Approval flow should grant access using approved.request");
  }
  if (!source.includes("const packageId = updatedRequest.packageId")) {
    throw new Error("Access grant should derive packageId from stored approved request");
  }
  if (!source.includes("...(updatedRequest.itemType === \"course\" ? [updatedRequest.itemId] : [])")) {
    throw new Error("Access grant should derive course target from stored approved request");
  }
  if (!source.includes("...(Array.isArray(updatedRequest.includedCourseIds) ? updatedRequest.includedCourseIds.map(String) : [])")) {
    throw new Error("Access grant should derive includedCourseIds from stored approved request");
  }
});

add("preview endpoint does not bypass invalid targets", () => {
  if (!previewBlock.includes("if (!resolvedTarget.ok)")) {
    throw new Error("Preview endpoint should reject unresolved targets");
  }
});

let failed = 0;
for (const item of checks) {
  try {
    item.fn();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error.message);
  }
}

if (failed > 0) {
  console.error(`\n${failed}/${checks.length} payment tampering checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} payment tampering checks passed.`);
