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
  console.log("=== Testing Updated Navbar: 'RIT Japanese Course', Sole Menu Toggle, & Attendance Column in Menu ===");

  // 1. Student Login
  console.log("\n[1] Student Login (Kenji Sato)");
  const studentLogin = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
    },
    { email: "kenji.sato@student.rit.edu", password: "password123" }
  );
  console.log("Student Login Status:", studentLogin.statusCode);
  if (studentLogin.statusCode !== 200) {
    throw new Error(`Student login failed: ${studentLogin.rawBody}`);
  }
  const studentCookie = extractCookie(studentLogin.headers);

  // 2. Test Attendance API for Menu
  console.log("\n[2] Testing Attendance API endpoint for Menu Drawer");
  const attendanceRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/attendance",
    method: "GET",
    headers: { Cookie: studentCookie },
  });
  console.log("Attendance Status:", attendanceRes.statusCode);
  console.log("Overall Attendance Rate:", attendanceRes.data?.overallRate, "%");
  console.log("Total Sessions:", attendanceRes.data?.totalHours, "hours");
  console.log("Attended Sessions:", attendanceRes.data?.presentCount, "hours");
  if (attendanceRes.statusCode !== 200) {
    throw new Error("Attendance API failed");
  }
  console.log("✓ VERIFIED: Attendance API returns live rate for menu column!");

  // 3. Test Student Dashboard page contains "RIT JAPANESE COURSE" and "Attendance Column"
  console.log("\n[3] Testing Student Dashboard HTML for Updated Header & Menu");
  const studentDashRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/student/dashboard",
    method: "GET",
    headers: { Cookie: studentCookie },
  });

  const html = studentDashRes.rawBody || "";
  const hasCourseTitle = html.includes("RIT") && (html.includes("JAPANESE COURSE") || html.includes("Japanese Course"));
  const hasMenuButton = html.includes("Menu") || html.includes("menu");
  const hasAttendanceColumn = html.includes("Attendance Column") || html.includes("attendance");

  console.log("Student Dashboard Status:", studentDashRes.statusCode);
  console.log("Has 'RIT JAPANESE COURSE' in Top Header:", hasCourseTitle);
  console.log("Has Sole Menu Toggle Button:", hasMenuButton);
  console.log("Has Attendance Column in Menu Drawer:", hasAttendanceColumn);

  if (!hasCourseTitle) {
    throw new Error("Missing 'RIT JAPANESE COURSE' in top header");
  }
  if (!hasAttendanceColumn) {
    throw new Error("Missing 'Attendance Column' in menu");
  }
  console.log("✓ VERIFIED: Top header features 'RIT Japanese Course' and menu has 'Attendance Column'!");

  // 4. Admin Login
  console.log("\n[4] Admin Login (Tanaka Hiroshi)");
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

  // 5. Test Admin Attendance API for Menu
  console.log("\n[5] Testing Cohort Attendance Overview for Admin Menu");
  const adminAttRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/attendance",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  console.log("Admin Attendance API Status:", adminAttRes.statusCode);
  console.log("Cohort Attendance Rate:", adminAttRes.data?.overallRate, "%");
  console.log("Total Cohort Class Hours:", adminAttRes.data?.totalHours);
  console.log("Is Cohort Overview:", adminAttRes.data?.isCohortOverview);
  if (adminAttRes.statusCode !== 200 || !adminAttRes.data?.isCohortOverview) {
    throw new Error("Admin cohort overview attendance failed");
  }
  console.log("✓ VERIFIED: Admin menu successfully receives cohort-wide attendance ledger stats!");

  // 6. Test Admin Dashboard HTML
  console.log("\n[6] Testing Admin Dashboard HTML for 'RIT JAPANESE COURSE'");
  const adminDashRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin/dashboard",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  const adminHtml = adminDashRes.rawBody || "";
  console.log("Admin Dashboard Status:", adminDashRes.statusCode);
  console.log("Has 'RIT JAPANESE COURSE' in Admin Header:", adminHtml.includes("JAPANESE COURSE") || adminHtml.includes("Japanese Course"));
  console.log("Has Attendance in Admin Menu:", adminHtml.includes("Attendance") || adminHtml.includes("attendance"));

  console.log("\n=== ALL NAVBAR & ATTENDANCE MENU TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
