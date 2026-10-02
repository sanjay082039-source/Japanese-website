import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { toAmPm, to24Hour, formatTimeRangeAmPm } from "@/lib/timeUtils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseLevel = searchParams.get("courseLevel");

    const whereClause: Record<string, unknown> = {};

    if (session.role === "STUDENT") {
      whereClause.courseLevel = session.courseLevel;
    } else if (courseLevel && courseLevel !== "ALL") {
      whereClause.courseLevel = courseLevel;
    }

    const slots = await prisma.timetableSlot.findMany({
      where: whereClause,
      include: {
        staff: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const formattedSlots = slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      startTimeAmPm: toAmPm(s.startTime),
      endTimeAmPm: toAmPm(s.endTime),
      timeRangeAmPm: formatTimeRangeAmPm(s.startTime, s.endTime),
      courseLevel: s.courseLevel,
      subject: s.subject,
      room: s.room,
      staffId: s.staffId,
      staffName: s.staff?.name || "Faculty Sensei",
    }));

    return NextResponse.json({ slots: formattedSlots });
  } catch (error: unknown) {
    console.error("Timetable error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required" }, { status: 403 });
    }

    const body = await request.json();
    const { dayOfWeek, startTime, endTime, courseLevel, subject, room, staffId } = body;

    if (!dayOfWeek || !startTime || !endTime || !courseLevel || !subject) {
      return NextResponse.json({ error: "Missing required timetable parameters" }, { status: 400 });
    }

    // Normalize times to 24h format for consistent storage
    const normalizedStart = to24Hour(startTime) || startTime;
    const normalizedEnd = to24Hour(endTime) || endTime;

    const slot = await prisma.timetableSlot.create({
      data: {
        dayOfWeek: parseInt(dayOfWeek, 10),
        startTime: normalizedStart,
        endTime: normalizedEnd,
        courseLevel,
        subject,
        room: room || "Room 101",
        staffId: staffId || session.id,
      },
      include: {
        staff: true,
      },
    });

    return NextResponse.json({
      success: true,
      slot: {
        ...slot,
        startTimeAmPm: toAmPm(slot.startTime),
        endTimeAmPm: toAmPm(slot.endTime),
        timeRangeAmPm: formatTimeRangeAmPm(slot.startTime, slot.endTime),
        staffName: slot.staff?.name || "Faculty Sensei",
      },
    });
  } catch (error: unknown) {
    console.error("Timetable slot create error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required" }, { status: 403 });
    }

    const body = await request.json();
    const { id, dayOfWeek, startTime, endTime, courseLevel, subject, room, staffId } = body;

    if (!id) {
      return NextResponse.json({ error: "Slot id is required for update" }, { status: 400 });
    }

    const existing = await prisma.timetableSlot.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Timetable slot not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (dayOfWeek !== undefined) updateData.dayOfWeek = parseInt(dayOfWeek, 10);
    if (startTime) updateData.startTime = to24Hour(startTime) || startTime;
    if (endTime) updateData.endTime = to24Hour(endTime) || endTime;
    if (courseLevel) updateData.courseLevel = courseLevel;
    if (subject) updateData.subject = subject;
    if (room !== undefined) updateData.room = room;
    if (staffId) updateData.staffId = staffId;

    const updated = await prisma.timetableSlot.update({
      where: { id },
      data: updateData,
      include: {
        staff: true,
      },
    });

    return NextResponse.json({
      success: true,
      slot: {
        ...updated,
        startTimeAmPm: toAmPm(updated.startTime),
        endTimeAmPm: toAmPm(updated.endTime),
        timeRangeAmPm: formatTimeRangeAmPm(updated.startTime, updated.endTime),
        staffName: updated.staff?.name || "Faculty Sensei",
      },
    });
  } catch (error: unknown) {
    console.error("Timetable slot update error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Slot id required" }, { status: 400 });
    }

    await prisma.timetableSlot.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Timetable slot delete error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
