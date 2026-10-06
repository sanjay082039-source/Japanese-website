import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import HourlyTimetable from "@/components/timetable/HourlyTimetable";

export const dynamic = "force-dynamic";

export default async function StudentTimetablePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch slots for student's level
  const slots = await prisma.timetableSlot.findMany({
    where: {
      courseLevel: session.courseLevel,
    },
    include: {
      staff: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const formattedSlots = slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    courseLevel: s.courseLevel as "N1" | "N2" | "N3" | "N4" | "N5",
    subject: s.subject,
    room: s.room,
    staffName: s.staff?.name || "Faculty Sensei",
  }));

  const batchDisplay = session.section ? (session.section.startsWith("Batch") ? session.section : `Batch ${session.section}`) : "Batch A";

  return (
    <div className="min-h-screen bg-[#070D18] pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
              Class Timetable
            </span>
            <span className="text-xs text-orange-400 font-mono font-bold">{batchDisplay}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            JLPT {session.courseLevel} Academic Schedule
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Weekly schedule grid for {batchDisplay}. All lecture times are displayed in AM / PM format. Active lectures are highlighted in real-time.
          </p>
        </div>

        <HourlyTimetable
          slots={formattedSlots}
          userRole="STUDENT"
          userCourseLevel={session.courseLevel}
        />
      </main>
    </div>
  );
}
