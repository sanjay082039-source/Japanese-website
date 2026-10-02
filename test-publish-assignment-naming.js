const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const reqOptions = { ...options };
    reqOptions.headers = reqOptions.headers || {};
    if (payload) {
      reqOptions.headers["Content-Type"] = "application/json";
      reqOptions.headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request(reqOptions, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const bodyStr = Buffer.concat(chunks).toString("utf-8");
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: bodyStr ? JSON.parse(bodyStr) : null,
            rawBody: bodyStr,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: bodyStr,
            rawBody: bodyStr,
          });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(headers) {
  const cookie = headers["set-cookie"];
  if (!cookie) return "";
  return Array.isArray(cookie) ? cookie[0].split(";")[0] : cookie.split(";")[0];
}

async function runTests() {
  console.log("=== Testing Renaming to 'Publish Assignment' ===");

  // 1. Admin Login
  console.log("\n[1] Admin Login");
  const adminLogin = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
    },
    { email: "admin.tanaka@rit.edu", password: "password123" }
  );
  console.log("Admin Login Status:", adminLogin.statusCode);
  const adminCookie = extractCookie(adminLogin.headers);

  // 2. Fetch Admin Assignments Page HTML
  console.log("\n[2] Checking Admin Assignments Page HTML");
  const adminAssignPageRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin/assignments",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  console.log("Admin Assignments Page Status:", adminAssignPageRes.statusCode);
  const html = adminAssignPageRes.rawBody || "";

  const hasPublishAssignment = html.includes("Publish Assignment");
  const hasOldGoogleForm = html.includes("Create Google Form Assignment") || html.includes("Host Google Form Assignment");

  console.log("Contains 'Publish Assignment':", hasPublishAssignment);
  console.log("Contains Old 'Create Google Form Assignment':", hasOldGoogleForm);

  if (!hasPublishAssignment) {
    throw new Error("Missing 'Publish Assignment' in admin page");
  }
  if (hasOldGoogleForm) {
    throw new Error("Found old 'Create Google Form Assignment' text");
  }
  console.log("✓ VERIFIED: Admin side successfully updated to 'Publish Assignment'!");

  // 3. Student Assignments Page
  console.log("\n[3] Student Login & Assignments Page Check");
  const studentLogin = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
    },
    { email: "kenji.sato@student.rit.edu", password: "password123" }
  );
  const studentCookie = extractCookie(studentLogin.headers);

  const studentAssignPageRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/student/assignments",
    method: "GET",
    headers: { Cookie: studentCookie },
  });
  console.log("Student Assignments Page Status:", studentAssignPageRes.statusCode);
  const studentHtml = studentAssignPageRes.rawBody || "";
  const hasCourseAssignments = studentHtml.includes("Course Assignments") || studentHtml.includes("Assignments");
  console.log("Student Page Has Course Assignments:", hasCourseAssignments);

  console.log("\n=== ALL RENAMING VERIFICATION CHECKS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
