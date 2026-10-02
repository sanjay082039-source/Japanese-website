const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding RIT Japanese Portal (Admin & Student Roles)...");

  // Clean existing data
  await prisma.cheatViolationLog.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.assignmentSubmission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  // 1. Create Admins (Admin Side)
  const adminTanaka = await prisma.user.create({
    data: {
      name: "Tanaka Hiroshi (田中 浩)",
      email: "admin.tanaka@rit.edu",
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
      courseLevel: "N1",
      section: "A",
      phone: "+81 90-1122-3344",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    },
  });

  const adminYamamoto = await prisma.user.create({
    data: {
      name: "Yamamoto Kenji (山本 健二)",
      email: "admin.yamamoto@rit.edu",
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
      courseLevel: "N2",
      section: "A",
      phone: "+81 90-4455-6677",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    },
  });

  console.log("Created Admin accounts (Tanaka Sensei & Yamamoto Sensei)");

  // 2. Create Students across N1 to N5 (Student Side)
  const studentData = [
    // N1
    {
      name: "Sakura Ito (伊藤 さくら)",
      email: "sakura.ito@student.rit.edu",
      courseLevel: "N1",
      section: "A",
      phone: "+81 80-2233-4455",
      targetAttendance: 0.95,
    },
    {
      name: "Daiki Kobayashi (小林 大樹)",
      email: "daiki.k@student.rit.edu",
      courseLevel: "N1",
      section: "A",
      phone: "+81 80-2233-9988",
      targetAttendance: 0.88,
    },
    // N2
    {
      name: "Ren Watanabe (渡辺 蓮)",
      email: "ren.watanabe@student.rit.edu",
      courseLevel: "N2",
      section: "A",
      phone: "+81 80-3344-5566",
      targetAttendance: 0.85,
    },
    {
      name: "Mei Nakamura (中村 芽依)",
      email: "mei.n@student.rit.edu",
      courseLevel: "N2",
      section: "B",
      phone: "+81 80-3344-7711",
      targetAttendance: 0.68, // At Risk (< 75%)
    },
    // N3
    {
      name: "Aoi Takahashi (高橋 葵)",
      email: "aoi.takahashi@student.rit.edu",
      courseLevel: "N3",
      section: "A",
      phone: "+81 80-4455-6677",
      targetAttendance: 0.92,
    },
    {
      name: "Sota Yoshida (吉田 颯太)",
      email: "sota.y@student.rit.edu",
      courseLevel: "N3",
      section: "B",
      phone: "+81 80-4455-8822",
      targetAttendance: 0.72, // At Risk
    },
    // N4
    {
      name: "Yuto Suzuki (鈴木 悠人)",
      email: "yuto.suzuki@student.rit.edu",
      courseLevel: "N4",
      section: "A",
      phone: "+81 80-5566-7788",
      targetAttendance: 0.65, // Below 75% threshold
    },
    {
      name: "Hina Yamada (山田 陽菜)",
      email: "hina.y@student.rit.edu",
      courseLevel: "N4",
      section: "A",
      phone: "+81 80-5566-9933",
      targetAttendance: 0.89,
    },
    // N5
    {
      name: "Kenji Sato (佐藤 健司)",
      email: "kenji.sato@student.rit.edu",
      courseLevel: "N5",
      section: "A",
      phone: "+81 80-6677-8899",
      targetAttendance: 0.94,
    },
    {
      name: "Kaito Inoue (井上 海斗)",
      email: "kaito.i@student.rit.edu",
      courseLevel: "N5",
      section: "B",
      phone: "+81 80-6677-0044",
      targetAttendance: 0.78,
    },
  ];

  const createdStudents = [];
  for (const s of studentData) {
    const student = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
        courseLevel: s.courseLevel,
        section: s.section,
        phone: s.phone,
      },
    });
    createdStudents.push({ ...student, targetAttendance: s.targetAttendance });
  }
  console.log(`Created ${createdStudents.length} students across N1-N5 in RIT Japanese Portal`);

  // 3. Create Timetable Slots
  const days = [1, 2, 3, 4, 5, 6];
  const hours = [
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "11:00", end: "12:00" },
    { start: "13:00", end: "14:00" },
    { start: "14:00", end: "15:00" },
    { start: "15:00", end: "16:00" },
  ];

  const subjectsByLevel = {
    N1: ["Kanji Mastery & Radicals", "Advanced Dokkai & Analysis", "Business Keigo", "Listening Intensive"],
    N2: ["Intermediate Kanji", "Compound Grammar Patterns", "Newspaper Dokkai", "Speed Listening Drills"],
    N3: ["Bridge Kanji & Radicals", "Conditional & Passive Grammar", "Daily Discourse", "JLPT N3 Listening Lab"],
    N4: ["Essential Kanji", "Te-form / Verb Conjugation Clinic", "Short Passage Reading", "Elementary Listening"],
    N5: ["Hiragana, Katakana & Basic Kanji", "Essential Particles (は・が・を・に・で)", "Survival Japanese Phrases", "Basic Audio Practice"],
  };

  for (const level of ["N1", "N2", "N3", "N4", "N5"]) {
    const subjList = subjectsByLevel[level];
    let subjIdx = 0;
    for (const day of days) {
      for (const h of hours) {
        const subject = subjList[subjIdx % subjList.length];
        subjIdx++;

        await prisma.timetableSlot.create({
          data: {
            dayOfWeek: day,
            startTime: h.start,
            endTime: h.end,
            courseLevel: level,
            subject,
            room: `RIT Lab ${100 + day * 2}`,
            staffId: level === "N1" || level === "N2" ? adminTanaka.id : adminYamamoto.id,
          },
        });
      }
    }
  }
  console.log("Created master timetable slots for RIT Japanese Portal");

  // 4. Generate Attendance History
  const pastDays = 14;
  const hourSlots = ["09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00", "13:00 - 14:00"];

  for (const student of createdStudents) {
    for (let d = pastDays; d >= 1; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      if (date.getDay() === 0) continue;

      for (const slot of hourSlots) {
        const rand = Math.random();
        let status = "PRESENT";
        if (rand > student.targetAttendance) {
          status = rand > student.targetAttendance + 0.05 ? "ABSENT" : "ON_LEAVE";
        }

        const subjList = subjectsByLevel[student.courseLevel];
        const subject = subjList[Math.floor(Math.random() * subjList.length)];

        await prisma.attendance.create({
          data: {
            studentId: student.id,
            date,
            hourSlot: slot,
            status,
            subject,
            remarks: status === "ON_LEAVE" ? "Medical Certificate Approved" : undefined,
          },
        });
      }
    }
  }
  console.log("Created attendance records");

  // 5. Create Examinations
  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // N5 Exam
  const examN5 = await prisma.exam.create({
    data: {
      title: "RIT Japanese N5 Mid-Term Assessment (言語知識・読解)",
      description: "Official RIT N5 timed assessment covering Kanji reading, basic particles, and reading comprehension.",
      courseLevel: "N5",
      startTime,
      endTime,
      durationMinutes: 45,
      totalMarks: 50,
      passingMarks: 25,
      isPublished: true,
      proctoringRules: JSON.stringify({
        clipboardBlock: true,
        devtoolsBlock: true,
        tabSwitchLimit: 3,
        fullScreenRequired: true,
        selectionBlock: true,
      }),
      questions: {
        create: [
          {
            questionText: "「山」の正しい読み方はどれですか？ (What is the correct reading for the kanji '山'?)",
            questionType: "MCQ",
            optionsJson: JSON.stringify(["かわ (kawa)", "やま (yama)", "うみ (umi)", "そら (sora)"]),
            correctOption: "1",
            marks: 10,
            orderIndex: 0,
          },
          {
            questionText: "わたし＿＿本を読みます。下線に入る助詞はどれですか？ (Which particle fills the blank?)",
            questionType: "MCQ",
            optionsJson: JSON.stringify(["は (wa)", "を (wo/o)", "に (ni)", "で (de)"]),
            correctOption: "1",
            marks: 10,
            orderIndex: 1,
          },
          {
            questionText: "「あした、学校へ＿＿＿。」空欄にふさわしい動詞はどれですか？",
            questionType: "MCQ",
            optionsJson: JSON.stringify(["行きます (ikimasu)", "行きました (ikimashita)", "行かないでした (ikanaideshita)", "行くでした (ikudeshita)"]),
            correctOption: "0",
            marks: 10,
            orderIndex: 2,
          },
          {
            questionText: "「犬」の読み方はどれですか？",
            questionType: "MCQ",
            optionsJson: JSON.stringify(["ねこ (neko)", "とり (tori)", "いぬ (inu)", "さかな (sakana)"]),
            correctOption: "2",
            marks: 10,
            orderIndex: 3,
          },
          {
            questionText: "自己紹介（じこしょうかい）を日本語で2行以上書いてください。(Write a short self-introduction in Japanese)",
            questionType: "SUBJECTIVE",
            optionsJson: JSON.stringify([]),
            correctOption: "はじめまして",
            marks: 10,
            orderIndex: 4,
          },
        ],
      },
    },
  });

  // Exams for N4, N3, N2, N1
  for (const lvl of ["N4", "N3", "N2", "N1"]) {
    await prisma.exam.create({
      data: {
        title: `RIT Japanese ${lvl} Assessment (Comprehensive)`,
        description: `Official RIT timed examination covering ${lvl} level vocabulary, grammar, and dokkai reading.`,
        courseLevel: lvl,
        startTime,
        endTime,
        durationMinutes: 60,
        totalMarks: 50,
        passingMarks: 25,
        isPublished: true,
        proctoringRules: JSON.stringify({
          clipboardBlock: true,
          devtoolsBlock: true,
          tabSwitchLimit: 3,
          fullScreenRequired: true,
          selectionBlock: true,
        }),
        questions: {
          create: [
            {
              questionText: `この文章における筆者の主張に最も合致するものはどれか。(Which statement matches the author's argument in ${lvl} reading?)`,
              questionType: "MCQ",
              optionsJson: JSON.stringify([
                "伝統文化の保存こそが現代社会の最優先課題である。",
                "国際化に伴い言語教育の方法論を抜本的に見直すべきである。",
                "個人の自由意志よりも集団の調和が常に重んじられるべきだ。",
                "技術革新がもたらす副作用に対してより慎重な姿勢が求められる。",
              ]),
              correctOption: "1",
              marks: 15,
              orderIndex: 0,
            },
            {
              questionText: "下線の言葉の用法として最も適切なものを一つ選びなさい。",
              questionType: "MCQ",
              optionsJson: JSON.stringify(["余儀なくされた", "やむを得ず", "かねない", "おそれがある"]),
              correctOption: "0",
              marks: 15,
              orderIndex: 1,
            },
            {
              questionText: `${lvl}重要文法のニュアンスを簡潔に説明してください。`,
              questionType: "SUBJECTIVE",
              optionsJson: JSON.stringify([]),
              correctOption: "解説",
              marks: 20,
              orderIndex: 2,
            },
          ],
        },
      },
    });
  }

  // 6. Create Assignments
  const assignmentList = [
    {
      title: "RIT N5 Kanji Writing Drill: Numbers & Family (一〜十、父母兄妹)",
      description: "Practice stroke orders and submit photograph/scan of 20 Kanji repetitions.",
      courseLevel: "N5",
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
    },
    {
      title: "RIT N4 Grammar Essay: 私の好きな日本の季節",
      description: "Write an 80-word composition utilizing '〜から', '〜ので', and '〜より'.",
      courseLevel: "N4",
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
    },
    {
      title: "RIT N3 Reading Synthesis: News Article on Technology",
      description: "Read NHK News Web Easy article, outline 3 main takeaways using passive forms.",
      courseLevel: "N3",
      dueDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
    },
    {
      title: "RIT N2 Business Email Practice",
      description: "Draft a formal corporate apology and schedule adjustment email using Keigo.",
      courseLevel: "N2",
      dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
    },
    {
      title: "RIT N1 Analytical Essay: 人工知能と言語習得の未来",
      description: "Produce a 400-kanji argumentative discourse utilizing formal written register.",
      courseLevel: "N1",
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
    },
  ];

  for (const a of assignmentList) {
    const createdAssign = await prisma.assignment.create({ data: a });
    const studentInLevel = createdStudents.find((s) => s.courseLevel === a.courseLevel);
    if (studentInLevel) {
      await prisma.assignmentSubmission.create({
        data: {
          assignmentId: createdAssign.id,
          studentId: studentInLevel.id,
          content: "先生、課題を提出いたします。添削のほどよろしくお願い申し上げます。(Submitted assignment to RIT portal.)",
          fileUrl: `https://portal.rit.edu/storage/submissions/${studentInLevel.id}_task.pdf`,
          submittedAt: new Date(),
          grade: 94.0,
          feedback: "大変よく書けています。(Excellent work!)",
          status: "GRADED",
        },
      });
    }
  }

  console.log("RIT Japanese Portal seeded successfully with Admin and Student roles!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
