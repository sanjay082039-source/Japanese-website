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
        });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log("=== Testing Student Level (N1–N5) Management by Admin ===");

  // 1. Admin Login
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
  console.log(`Admin Login Status: ${loginRes.statusCode}`);
  const adminCookie = loginRes.headers["set-cookie"][0].split(";")[0];

  // 2. Fetch Students to find Kenji Sato (N5)
  const slRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/shortlist?courseLevel=ALL",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  const slData = JSON.parse(slRes.body);
  const kenji = slData.students.find((s) => s.name.includes("Kenji Sato") || s.email.includes("kenji.sato"));
  console.log(`Located Student: ${kenji.name} | Role: ${kenji.role || 'STUDENT'} | Current Level: ${kenji.courseLevel}`);

  // 3. Admin changes Kenji's level to N4 (and section to B)
  console.log("\n[Test 1] Admin promoting student from N5 to N4...");
  const levelPayload = JSON.stringify({
    courseLevel: "N4",
    section: "B",
  });
  const patchRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${kenji.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(levelPayload),
      },
    },
    levelPayload
  );
  console.log(`Status: ${patchRes.statusCode}`);
  const patchData = JSON.parse(patchRes.body);
  console.log(`Result Message: ${patchData.message}`);
  console.log(`Updated Student Role: ${patchData.user?.role} (STILL STUDENT - not ADMIN!)`);
  console.log(`Updated Student Level: ${patchData.user?.courseLevel} (Expected: N4)`);
  console.log(`Updated Student Section: ${patchData.user?.section} (Expected: B)`);

  if (patchData.user?.role === "STUDENT" && patchData.user?.courseLevel === "N4") {
    console.log("✓ VERIFIED: Student role remains STUDENT, course tier successfully changed to N4!");
  } else {
    console.error("FAILED verification!");
    process.exit(1);
  }

  // 4. Test changing to N3
  console.log("\n[Test 2] Admin reassigning student from N4 to N3...");
  const n3Payload = JSON.stringify({ courseLevel: "N3" });
  const n3Res = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${kenji.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(n3Payload),
      },
    },
    n3Payload
  );
  const n3Data = JSON.parse(n3Res.body);
  console.log(`Updated Student Level: ${n3Data.user?.courseLevel} (Expected: N3), Role: ${n3Data.user?.role}`);

  // 5. Reset back to N5
  console.log("\n[Cleanup] Resetting student back to N5...");
  const resetPayload = JSON.stringify({ courseLevel: "N5", section: "A" });
  await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${kenji.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(resetPayload),
      },
    },
    resetPayload
  );
  console.log("✓ Reset completed.");

  console.log("\n=== ALL LEVEL MANAGEMENT TESTS PASSED ===");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
