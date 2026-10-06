import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { detectDeviceType } from "@/lib/device";

export const dynamic = "force-dynamic";

// In production, derive rpID and origin dynamically or from env
const RP_NAME = "RIT Japanese Academy Biometric Portal";
const RP_ID = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : "localhost";
const ORIGIN = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Global cache for challenges in-memory (per user)
const currentChallenges = new Map<string, string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, studentId, response: credResponse } = body;

    // 1. GENERATE REGISTRATION OPTIONS (Student Enrollment)
    if (action === "REGISTER_OPTIONS") {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const existingCreds = await prisma.biometricCredential.findMany({
        where: { userId: session.id },
      });

      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: Buffer.from(session.id),
        userName: session.email,
        userDisplayName: session.name,
        attestationType: "none",
        excludeCredentials: existingCreds.map((c) => ({
          id: c.credentialId,
          transports: c.transports ? JSON.parse(c.transports) : undefined,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });

      currentChallenges.set(`reg_${session.id}`, options.challenge);
      return NextResponse.json(options);
    }

    // 2. VERIFY REGISTRATION RESPONSE (Save Credential)
    if (action === "REGISTER_VERIFY") {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const expectedChallenge = currentChallenges.get(`reg_${session.id}`);
      if (!expectedChallenge) {
        return NextResponse.json({ error: "Registration session timed out or invalid." }, { status: 400 });
      }

      const verification = await verifyRegistrationResponse({
        response: credResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({ error: "Biometric enrollment verification failed." }, { status: 400 });
      }

      const { credential } = verification.registrationInfo;
      const deviceType = detectDeviceType(request.headers.get("user-agent"));

      // Store in BiometricCredential
      await prisma.biometricCredential.upsert({
        where: { credentialId: credential.id },
        create: {
          userId: session.id,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64"),
          counter: credential.counter,
          deviceType,
          transports: credResponse.response.transports ? JSON.stringify(credResponse.response.transports) : null,
        },
        update: {
          publicKey: Buffer.from(credential.publicKey).toString("base64"),
          counter: credential.counter,
          deviceType,
        },
      });

      currentChallenges.delete(`reg_${session.id}`);
      return NextResponse.json({ success: true, message: "Biometric authenticator enrolled successfully." });
    }

    // 3. GENERATE AUTHENTICATION OPTIONS (Terminal Scan - Kiosk or Specific Student)
    if (action === "AUTH_OPTIONS") {
      let allowedCreds: Array<{ credentialId: string; transports?: string | null }> = [];

      if (studentId) {
        allowedCreds = await prisma.biometricCredential.findMany({
          where: { userId: studentId },
          select: { credentialId: true, transports: true },
        });

        if (allowedCreds.length === 0) {
          return NextResponse.json(
            { error: "No biometric authenticator enrolled for this student. Student must enroll in settings first." },
            { status: 404 }
          );
        }
      } else {
        // Office Kiosk Terminal Mode: Allow ANY enrolled student in the directory
        allowedCreds = await prisma.biometricCredential.findMany({
          select: { credentialId: true, transports: true },
        });

        if (allowedCreds.length === 0) {
          return NextResponse.json(
            { error: "No biometric credentials registered in the portal database yet." },
            { status: 404 }
          );
        }
      }

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: allowedCreds.map((c) => ({
          id: c.credentialId,
          transports: c.transports ? JSON.parse(c.transports) : undefined,
        })),
        userVerification: "preferred",
      });

      const challengeKey = studentId ? `auth_${studentId}` : `auth_kiosk_${options.challenge}`;
      currentChallenges.set(challengeKey, options.challenge);
      // Also cache global active kiosk challenge
      currentChallenges.set("auth_kiosk_latest", options.challenge);

      return NextResponse.json(options);
    }

    // 4. VERIFY AUTHENTICATION RESPONSE (Live Attendance Validation)
    if (action === "AUTH_VERIFY") {
      if (!credResponse || !credResponse.id) {
        return NextResponse.json({ error: "Invalid credential response from sensor." }, { status: 400 });
      }

      // Look up credential in DB to identify the student
      const dbCred = await prisma.biometricCredential.findUnique({
        where: { credentialId: credResponse.id },
        include: {
          user: {
            select: { id: true, name: true, email: true, courseLevel: true, section: true },
          },
        },
      });

      if (!dbCred || !dbCred.user) {
        return NextResponse.json(
          {
            verified: false,
            error: "INVALID_OR_NOT_REGISTERED",
            message: "Fingerprint rejected: Biometric credential not registered in the system.",
          },
          { status: 404 }
        );
      }

      // Check expected challenge
      let expectedChallenge = studentId
        ? currentChallenges.get(`auth_${studentId}`)
        : currentChallenges.get("auth_kiosk_latest");

      if (!expectedChallenge) {
        // Fallback search in challenges
        currentChallenges.forEach((val, key) => {
          if (!expectedChallenge && key.startsWith("auth_")) {
            expectedChallenge = val;
          }
        });
      }

      if (!expectedChallenge) {
        return NextResponse.json({ error: "Verification challenge expired or invalid." }, { status: 400 });
      }

      const verification = await verifyAuthenticationResponse({
        response: credResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: dbCred.credentialId,
          publicKey: new Uint8Array(Buffer.from(dbCred.publicKey, "base64")),
          counter: dbCred.counter,
        },
      });

      if (!verification.verified) {
        return NextResponse.json(
          {
            verified: false,
            error: "INVALID_OR_NOT_REGISTERED",
            message: "Biometric sensor hardware validation failed.",
          },
          { status: 400 }
        );
      }

      // Update counter
      await prisma.biometricCredential.update({
        where: { credentialId: dbCred.credentialId },
        data: { counter: verification.authenticationInfo.newCounter },
      });

      return NextResponse.json({
        success: true,
        verified: true,
        student: dbCred.user,
        credentialId: dbCred.credentialId,
        message: `Biometric confirmed for ${dbCred.user.name}.`,
      });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Biometric route error:", error);
    return NextResponse.json({ error: error.message || "Biometric service error" }, { status: 500 });
  }
}
