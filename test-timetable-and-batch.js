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
  console.log("=== Testing Timetable Time Editing (AM/PM) & Student Batch Editing ===");

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
  console.log(`Admin Login Status: ${loginRes.statusCode}`);
  const adminCookie = loginRes.headers["set-cookie"][0].split(";")[0];

  // 2. Test Editing Student Batch
  console.log("\n[2] Testing Student Batch Modification (Admin side)");
  const shortlistRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/admin/shortlist?courseLevel=ALL",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  const shortlistData = JSON.parse(shortlistRes.body);
  const targetStudent = shortlistData.students[0];
  console.log(`Candidate: ${targetStudent.name} | Current Batch: ${targetStudent.section}`);

  const updateBatchPayload = JSON.stringify({
    batch: "Morning Batch 2026",
    courseLevel: targetStudent.courseLevel,
  });
  const updateBatchRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${targetStudent.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(updateBatchPayload),
      },
    },
    updateBatchPayload
  );
  console.log(`Update Batch Status: ${updateBatchRes.statusCode}`);
  const updateBatchData = JSON.parse(updateBatchRes.body);
  console.log(`Result Message: ${updateBatchData.message}`);
  console.log(`Updated Batch in DB: "${updateBatchData.user?.section}" (Expected: Morning Batch 2026)`);

  if (updateBatchData.user?.section === "Morning Batch 2026") {
    console.log("✓ VERIFIED: Student batch successfully modified by admin!");
  } else {
    console.error("Batch update failed verification!");
    process.exit(1);
  }

  // 3. Test Timetable AM / PM Retrieval
  console.log("\n[3] Testing Timetable Retrieval with AM / PM Format");
  const tableRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/timetable?courseLevel=ALL",
    method: "GET",
    headers: { Cookie: adminCookie },
  });
  console.log(`Timetable Status: ${tableRes.statusCode}`);
  const tableData = JSON.parse(tableRes.body);
  console.log(`Total Slots Retrieved: ${tableData.slots?.length}`);

  const sampleSlot = tableData.slots[0];
  console.log(`Sample Slot: "${sampleSlot.subject}" (${sampleSlot.courseLevel})`);
  console.log(`Raw Start: ${sampleSlot.startTime} | Raw End: ${sampleSlot.endTime}`);
  console.log(`AM/PM Start: ${sampleSlot.startTimeAmPm} | AM/PM End: ${sampleSlot.endTimeAmPm}`);
  console.log(`Formatted AM/PM Range: ${sampleSlot.timeRangeAmPm}`);

  const hasAmPm = sampleSlot.timeRangeAmPm.includes("AM") || sampleSlot.timeRangeAmPm.includes("PM");
  if (hasAmPm) {
    console.log("✓ VERIFIED: Timetable slot times rendered in AM and PM format!");
  } else {
    console.error("AM/PM verification failed!");
    process.exit(1);
  }

  // 4. Test Editing Timetable Slot Time & Details (PUT /api/timetable)
  console.log("\n[4] Testing Admin Editing Timetable Slot Time (PUT /api/timetable)");
  const editSlotPayload = JSON.stringify({
    id: sampleSlot.id,
    dayOfWeek: sampleSlot.dayOfWeek,
    startTime: "10:30 AM",
    endTime: "11:30 AM",
    courseLevel: sampleSlot.courseLevel,
    subject: "Intensive Kanji & Dokkai Workshop",
    room: "Language Lab 402",
  });
  const editSlotRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/timetable",
      method: "PUT",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(editSlotPayload),
      },
    },
    editSlotPayload
  );
  console.log(`Edit Slot Status: ${editSlotRes.statusCode}`);
  const editSlotData = JSON.parse(editSlotRes.body);
  console.log(`Updated Slot Subject: "${editSlotData.slot?.subject}"`);
  console.log(`Updated Start Time: ${editSlotData.slot?.startTimeAmPm} (Stored: ${editSlotData.slot?.startTime})`);
  console.log(`Updated End Time: ${editSlotData.slot?.endTimeAmPm} (Stored: ${editSlotData.slot?.endTime})`);
  console.log(`Updated AM/PM Range: ${editSlotData.slot?.timeRangeAmPm}`);
  console.log(`Updated Venue: ${editSlotData.slot?.room}`);

  if (editSlotData.slot?.timeRangeAmPm === "10:30 AM - 11:30 AM") {
    console.log("✓ VERIFIED: Admin successfully edited slot time to 10:30 AM - 11:30 AM!");
  } else {
    console.error("Edit slot time failed verification!");
    process.exit(1);
  }

  // Restore slot back to standard time
  console.log("\n[Cleanup] Resetting sample slot back to 09:00 AM - 10:00 AM...");
  await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/timetable",
      method: "PUT",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
    },
    JSON.stringify({
      id: sampleSlot.id,
      startTime: "09:00 AM",
      endTime: "10:00 AM",
      subject: "Kanji & Vocabulary Basics",
    })
  );

  // Restore student batch back to "A"
  await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/admin/users/${targetStudent.id}/role`,
      method: "PATCH",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
    },
    JSON.stringify({
      batch: "A",
      courseLevel: targetStudent.courseLevel,
    })
  );
  console.log("✓ Cleanup restored.");

  console.log("\n=== ALL TIMETABLE EDITING & BATCH MODIFICATION TESTS PASSED ===");
}

run().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
