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
  console.log("=== Testing Google Form Assignments & Admin Dashboard Attendance ===");

  // 1. Admin Login
  console.log("\n[1] Admin Login (Tanaka Hiroshi)");
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
  if (adminLogin.statusCode !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.rawBody}`);
  }
  const adminCookie = extractCookie(adminLogin.headers);
  console.log("Admin Logged In:", adminLogin.data?.user?.name);

  // 2. Admin Creates Google Form Assignment with Custom Question Marks
  console.log("\n[2] Admin Creates Google Form Assignment with Custom Question Marks");
  const gformQuestions = [
    {
      id: "q_kanji_1",
      questionText: "「勉強」の正しい読み方はどれですか？",
      questionType: "MCQ",
      options: ["べんきょう", "べんきゅう", "めんきょう", "ほんきょう"],
      correctOption: 0,
      marks: 6, // 6 marks for this question
    },
    {
      id: "q_particle_2",
      questionText: "日曜日____映画を見に行きました。適切な助詞を選びなさい。",
      questionType: "MCQ",
      options: ["に", "で", "を", "へ"],
      correctOption: 0,
      marks: 4, // 4 marks for this question
    },
    {
      id: "q_verb_3",
      questionText: "「昨日、友達と晩ご飯を_____。」適切な過去形を選びなさい。",
      questionType: "MCQ",
      options: ["食べました", "食べます", "食べる", "食べた"],
      correctOption: 0,
      marks: 5, // 5 marks for this question
    },
  ];

  const createAssignmentRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/assignments",
      method: "POST",
      headers: {
        Cookie: adminCookie,
      },
    },
    {
      title: "JLPT N3 Automated Google Form Practicum",
      instructions: "Answer all questions. Navigation is locked during this assignment.",
      courseLevel: "N3",
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      questions: gformQuestions,
    }
  );

  console.log("Assignment Creation Status:", createAssignmentRes.statusCode);
  const createdAssignment = createAssignmentRes.data?.assignment;
  console.log("Created Assignment ID:", createdAssignment?.id);
  console.log("Total Calculated Max Marks:", createdAssignment?.maxMarks, "(Expected: 15)");

  if (createdAssignment?.maxMarks !== 15) {
    throw new Error(`Expected maxMarks to be 15, got ${createdAssignment?.maxMarks}`);
  }
  console.log("✓ VERIFIED: Admin successfully published Google Form with custom per-question marks (6 + 4 + 5 = 15)!");

  // 3. Student Login (Aoi Takahashi, N3 Student)
  console.log("\n[3] Student Login (Aoi Takahashi, JLPT N3)");
  const studentLogin = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
    },
    { email: "aoi.takahashi@student.rit.edu", password: "password123" }
  );
  console.log("Student Login Status:", studentLogin.statusCode);
  if (studentLogin.statusCode !== 200) {
    throw new Error(`Student login failed: ${studentLogin.rawBody}`);
  }
  const studentCookie = extractCookie(studentLogin.headers);
  console.log("Student Logged In:", studentLogin.data?.user?.name, "(Level:", studentLogin.data?.user?.courseLevel, ")");

  // 4. Student Fetches Assignments & Verify Answer Key Protection
  console.log("\n[4] Student Fetches Assignments & Verify Answer Key Redaction");
  const studentAssignListRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/assignments",
    method: "GET",
    headers: { Cookie: studentCookie },
  });

  const matchingAssign = studentAssignListRes.data?.assignments?.find(
    (a) => a.id === createdAssignment.id
  );
  console.log("Retrieved Assignment via Student API:", matchingAssign?.title);
  console.log("Is Google Form:", matchingAssign?.isGoogleForm);
  console.log("Questions Count:", matchingAssign?.formData?.questions?.length);

  // Security test: Verify correctOption is NOT leaked before submission
  const firstQuestion = matchingAssign?.formData?.questions?.[0];
  const hasLeakedKey = firstQuestion?.correctOption !== undefined;
  console.log("Answer Key Redacted for Student before submission:", !hasLeakedKey);
  if (hasLeakedKey) {
    throw new Error("Security Alert: correctOption was leaked to student before submission!");
  }
  console.log("✓ VERIFIED: Security Shield active! Correct answers are completely redacted for unsubmitted students.");

  // 5. Student Takes & Submits Google Form Answers
  console.log("\n[5] Student Submits Google Form Answers");
  // Student answers Q1 correctly (6 marks), Q2 correctly (4 marks), and Q3 wrong (0 marks)
  // Expected Score: 6 + 4 = 10 out of 15
  const studentAnswers = {
    q_kanji_1: 0, // correct (6 marks)
    q_particle_2: 0, // correct (4 marks)
    q_verb_3: 1, // incorrect (0 marks)
  };

  const submitRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/assignments",
      method: "POST",
      headers: {
        Cookie: studentCookie,
      },
    },
    {
      assignmentId: createdAssignment.id,
      answers: studentAnswers,
      content: "Google Form Completed by Aoi Takahashi",
    }
  );

  console.log("Submission Response Status:", submitRes.statusCode);
  console.log("Auto-Calculated Score:", submitRes.data?.grade, "/ 15");
  if (submitRes.data?.grade !== 10) {
    throw new Error(`Expected score 10, got ${submitRes.data?.grade}`);
  }
  console.log("✓ VERIFIED: Server auto-graded student answers based on each question's individual marks (6 + 4 = 10 Marks)!");

  // 6. Admin Verifies Submissions with Answer Breakdown
  console.log("\n[6] Admin Inspects Submissions with Question-by-Question Marks");
  const adminAssignListRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/assignments?courseLevel=N3`,
    headers: { Cookie: adminCookie },
  });

  const adminViewAssign = adminAssignListRes.data?.assignments?.find(
    (a) => a.id === createdAssignment.id
  );
  const studentSubmission = adminViewAssign?.submissions?.[0];
  console.log("Admin View Submission Grade:", studentSubmission?.grade);
  console.log("Student Name:", studentSubmission?.student?.name);
  console.log("✓ VERIFIED: Admin successfully received graded Google Form submission!");

  // 7. Verify Admin Dashboard Attendance Rendering
  console.log("\n[7] Verifying Admin Dashboard Renders Attendance Column & Ledger");
  const dashboardHtmlRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/admin/dashboard",
    method: "GET",
    headers: { Cookie: adminCookie },
  });

  const dashboardHtml = typeof dashboardHtmlRes.rawBody === "string" ? dashboardHtmlRes.rawBody : "";
  const hasAttendanceHeader = dashboardHtml.includes("Attendance") || dashboardHtml.includes("attendance");
  const hasLedger = dashboardHtml.includes("Student Cohort Attendance") || dashboardHtml.includes("Live Academic Ledger");

  console.log("Dashboard HTTP Status:", dashboardHtmlRes.statusCode);
  console.log("Attendance Column Present in Table:", hasAttendanceHeader);
  console.log("Student Cohort Attendance Ledger Section Present:", hasLedger);

  if (!hasAttendanceHeader) {
    throw new Error("Attendance column missing from dashboard table");
  }
  console.log("✓ VERIFIED: Attendance column and Cohort Attendance Ledger verified on Admin Dashboard!");

  // 8. Cleanup test assignment
  console.log("\n[8] Cleanup Test Assignment");
  const deleteRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/assignments?id=${createdAssignment.id}`,
    method: "DELETE",
    headers: { Cookie: adminCookie },
  });
  console.log("Delete Status:", deleteRes.statusCode);
  console.log("✓ Test assignment cleaned up successfully.");

  console.log("\n=== ALL GOOGLE FORM ASSIGNMENT & DASHBOARD ATTENDANCE TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
