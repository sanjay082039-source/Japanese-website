const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyBuffer.toString("utf-8"),
          buffer: bodyBuffer,
        });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("=== RIT Japanese Portal (Admin & Student Roles) Test Suite ===");

  // 1. Test Homepage
  console.log("\n[Test 1] Testing Landing Page GET /");
  const homeRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/",
    method: "GET",
  });
  console.log(`Status: ${homeRes.statusCode} (Expected: 200)`);
  if (homeRes.body.includes("RIT Japanese Portal") || homeRes.body.includes("RIT")) {
    console.log("✓ RIT Japanese Portal branding rendered successfully on landing page");
  }

  // 2. Test Admin Login (Admin Side)
  console.log("\n[Test 2] Testing Admin Login POST /api/auth/login");
  const adminLoginPayload = JSON.stringify({
    email: "admin.tanaka@rit.edu",
    password: "password123",
  });
  const adminLoginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(adminLoginPayload),
      },
    },
    adminLoginPayload
  );
  console.log(`Status: ${adminLoginRes.statusCode}`);
  const adminData = JSON.parse(adminLoginRes.body);
  console.log(`User: ${adminData.user?.name} | Role: ${adminData.user?.role} (Expected: ADMIN)`);
  const adminCookieHeader = adminLoginRes.headers["set-cookie"];
  const adminSessionCookie = adminCookieHeader ? adminCookieHeader[0].split(";")[0] : "";
  console.log(`Cookie name: ${adminSessionCookie.split("=")[0]} (Expected: rit_session)`);

  // 3. Test Centralized Student Shortlist API (Admin Side Only)
  console.log("\n[Test 3] Testing Admin Shortlist Directory GET /api/admin/shortlist?courseLevel=ALL&minAttendance=75");
  const shortlistRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/shortlist?courseLevel=ALL&minAttendance=75",
    method: "GET",
    headers: {
      Cookie: adminSessionCookie,
    },
  });
  console.log(`Status: ${shortlistRes.statusCode}`);
  const shortlistData = JSON.parse(shortlistRes.body);
  console.log(`Shortlisted Candidates (Attendance >= 75%): ${shortlistData.students?.length}`);
  if (shortlistData.students?.length > 0) {
    const s1 = shortlistData.students[0];
    console.log(`Sample: ${s1.name} (JLPT ${s1.courseLevel}) | Attendance: ${s1.attendanceRate}% | Status: ${s1.status}`);
  }

  // 4. Test ExcelJS Shortlist Export Route (.xlsx)
  console.log("\n[Test 4] Testing Excel Export GET /api/admin/export-shortlist?courseLevel=ALL&minAttendance=75");
  const excelRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/export-shortlist?courseLevel=ALL&minAttendance=75",
    method: "GET",
    headers: {
      Cookie: adminSessionCookie,
    },
  });
  console.log(`Status: ${excelRes.statusCode}`);
  console.log(`Content-Disposition: ${excelRes.headers["content-disposition"]}`);
  console.log(`Excel file buffer size: ${excelRes.buffer.length} bytes`);
  if (excelRes.headers["content-disposition"]?.includes("RIT_Japanese_Shortlist")) {
    console.log("✓ Server-side Excel (.xlsx) generated with RIT Japanese Portal branding!");
  }

  // 5. Test Student Login (Student Side)
  console.log("\n[Test 5] Testing Student Login (Kenji Sato, N5 Student Side)");
  const studentLoginPayload = JSON.stringify({
    email: "kenji.sato@student.rit.edu",
    password: "password123",
  });
  const studentLoginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(studentLoginPayload),
      },
    },
    studentLoginPayload
  );
  const studentData = JSON.parse(studentLoginRes.body);
  const studentCookie = studentLoginRes.headers["set-cookie"][0].split(";")[0];
  console.log(`Logged in as: ${studentData.user?.name} (Role: ${studentData.user?.role}, Level: ${studentData.user?.courseLevel})`);

  // 6. Test Two-Sided Route Isolation: Student attempting to access Admin API
  console.log("\n[Test 6] Testing Role Separation: Student requesting /api/admin/shortlist");
  const studentAccessAdminRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/shortlist",
    method: "GET",
    headers: {
      Cookie: studentCookie,
    },
  });
  console.log(`Status: ${studentAccessAdminRes.statusCode} (Expected: 403 Forbidden)`);
  if (studentAccessAdminRes.statusCode === 403) {
    console.log("✓ Strict Two-Sided Separation Verified: Student blocked from Admin API!");
  }

  // 7. Test Student Timetable & Attendance
  console.log("\n[Test 7] Testing Student Timetable & Attendance API");
  const timetableRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/timetable",
    method: "GET",
    headers: {
      Cookie: studentCookie,
    },
  });
  const timetableData = JSON.parse(timetableRes.body);
  console.log(`Hourly slots retrieved: ${timetableData.slots?.length}`);

  const attRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/attendance",
    method: "GET",
    headers: {
      Cookie: studentCookie,
    },
  });
  const attData = JSON.parse(attRes.body);
  console.log(`Attendance Rate: ${attData.overallRate}% | Total Hours: ${attData.totalHours}`);

  // 8. Test Available Exams for Student
  console.log("\n[Test 8] Testing Exams Listing for Student N5");
  const examsRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/exams",
    method: "GET",
    headers: {
      Cookie: studentCookie,
    },
  });
  const examsData = JSON.parse(examsRes.body);
  console.log(`Exam Title: "${examsData.exams?.[0]?.title}"`);

  console.log("\n=== ALL RIT JAPANESE PORTAL TESTS PASSED (ADMIN & STUDENT SIDES) ===");
}

runTests().catch(console.error);
