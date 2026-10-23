import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privilege required." },
        { status: 403 }
      );
    }

    const targetUserId = params.id;
    const body = await request.json();
    const { role, courseLevel, section, batch } = body;
    const targetBatch = batch !== undefined ? String(batch).trim() : (section !== undefined ? String(section).trim() : undefined);

    const validLevels = ["N1", "N2", "N3", "N4", "N5"];
    if (courseLevel && !validLevels.includes(courseLevel)) {
      return NextResponse.json(
        { error: "Invalid courseLevel. Must be one of N1, N2, N3, N4, N5." },
        { status: 400 }
      );
    }

    if (role && role !== "ADMIN" && role !== "STUDENT") {
      return NextResponse.json(
        { error: "Invalid role specified. Role must be 'ADMIN' or 'STUDENT'." },
        { status: 400 }
      );
    }

    if (!role && !courseLevel && targetBatch === undefined) {
      return NextResponse.json(
        { error: "No update parameters provided (courseLevel, batch, or role required)." },
        { status: 400 }
      );
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Prevent admin from locking themselves out if they are the only admin
    if (role && user.id === session.id && role === "STUDENT") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote yourself: You are the sole active Administrator." },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (courseLevel) updateData.courseLevel = courseLevel;
    if (targetBatch !== undefined) updateData.section = targetBatch;
    if (role) updateData.role = role;

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        courseLevel: true,
        section: true,
      },
    });

    let changeDescription = `Student ${updatedUser.name} updated successfully.`;
    if (courseLevel && targetBatch !== undefined) {
      changeDescription = `Student ${updatedUser.name} reassigned to JLPT ${courseLevel} (Batch: ${targetBatch}).`;
    } else if (targetBatch !== undefined) {
      changeDescription = `Student ${updatedUser.name}'s batch updated to ${targetBatch}.`;
    } else if (courseLevel) {
      changeDescription = `Student ${updatedUser.name} reassigned to JLPT ${courseLevel}.`;
    } else if (role) {
      changeDescription = `User role successfully updated to ${role}.`;
    }

    return NextResponse.json({
      success: true,
      message: changeDescription,
      user: updatedUser,
    });
  } catch (error: unknown) {
    console.error("Role update error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
