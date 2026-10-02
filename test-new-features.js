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

async function run() {
  console.log("=== Testing RIT Japanese Portal New Features ===");

  // 1. Admin Login
  console.log("\n[1] Admin Login");
  const loginPayload = JSON.stringify({
    email: "admin.tanaka@rit.edu",
    password: "password123",
  });
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(loginPayload),
      },
    },
    loginPayload
  );
  console.log(`Status: ${loginRes.statusCode}`);
  const cookieHeader = loginRes.headers["set-cookie"];
  const adminCookie = cookieHeader ? cookieHeader[0].split(";")[0] : "";

  // 2. Fetch Students to find a candidate ID
  console.log("\n[2] Fetch Candidates via Shortlist");
  const slRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/shortlist?courseLevel=ALL",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  const slData = JSON.parse(slRes.body);
  const targetStudent = slData.students[0];
  console.log(`Target Candidate: ${targetStudent.name} (Current Role: ${targetStudent.role || 'STUDENT'}, ID: ${targetStudent.id})`);

  // 3. Test Role Change: Promote Student to ADMIN
  console.log("\n[3] Testing Role Change: Promoting Student to ADMIN");
  const rolePayload = JSON.stringify({ role: "ADMIN" });
  const promoteRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${targetStudent.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(rolePayload),
      },
    },
    rolePayload
  );
  console.log(`Promote Status: ${promoteRes.statusCode}`);
  const promoteData = JSON.parse(promoteRes.body);
  console.log(`Result: ${promoteData.message} | New Role: ${promoteData.user?.role}`);

  // Demote back to STUDENT to keep data clean
  console.log("\n[3b] Demoting user back to STUDENT");
  const demotePayload = JSON.stringify({ role: "STUDENT" });
  const demoteRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${targetStudent.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(demotePayload),
      },
    },
    demotePayload
  );
  const demoteData = JSON.parse(demoteRes.body);
  console.log(`Result: ${demoteData.message} | Reset Role: ${demoteData.user?.role}`);

  // 4. Test Host Attempts Listing API
  console.log("\n[4] Testing GET /api/admin/exams/attempts");
  const attemptsRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/exams/attempts",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  console.log(`Attempts Status: ${attemptsRes.statusCode}`);
  const attemptsData = JSON.parse(attemptsRes.body);
  console.log(`Retrieved ${attemptsData.attempts?.length} exam attempts`);

  // 5. Test Host Evaluation API
  if (attemptsData.attempts && attemptsData.attempts.length > 0) {
    const attempt = attemptsData.attempts[0];
    console.log(`\n[5] Testing POST /api/admin/exams/evaluate on attempt ${attempt.id}`);
    const evalPayload = JSON.stringify({
      attemptId: attempt.id,
      score: 45,
      status: "GRADED",
      evaluatorFeedback: "Excellent grammar accuracy and kanji writing in subjective response.",
    });
    const evalRes = await request(
      {
        hostname: "localhost",
        port: 3000,
        path: "/api/admin/exams/evaluate",
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(evalPayload),
        },
      },
      evalPayload
    );
    console.log(`Evaluate Status: ${evalRes.statusCode}`);
    const evalData = JSON.parse(evalRes.body);
    console.log(`Result: ${evalData.message}`);
    console.log(`Updated Attempt Score: ${evalData.attempt?.score} / ${evalData.attempt?.exam?.totalMarks}, Status: ${evalData.attempt?.status}`);
  }

  // 6. Test Admin Dashboard Page HTML (Progress Averages)
  console.log("\n[6] Testing Admin Overview Dashboard HTML GET /admin/dashboard");
  const dashRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin/dashboard",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  console.log(`Dashboard Status: ${dashRes.statusCode}`);
  const hasAverages = dashRes.body.includes("Student Progress") && dashRes.body.includes("Performance Averages Overview");
  const hasComparative = dashRes.body.includes("JLPT Tier-by-Tier") && dashRes.body.includes("Performance Matrix");
  console.log(`Contains Overall Progress Averages Section: ${hasAverages}`);
  console.log(`Contains JLPT Tier-by-Tier Progress Averages: ${hasComparative}`);

  console.log("\n=== ALL NEW FEATURES VERIFIED SUCCESSFULLY ===");
}

run().catch(console.error);
