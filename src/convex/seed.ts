import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateEmployeeId } from "./helpers";

// ─── Set role for a user by email ───────────────────────────────
// Use this from Convex dashboard to set admin/employee roles

export const setRoleByEmail = mutation({
  args: {
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (!user) return { error: `No user found with email: ${args.email}` };

    await ctx.db.patch(user._id, { role: args.role as any });
    return { success: true, userId: user._id, role: args.role };
  },
});

// ─── Seed specific test users ────────────────────────────────────

export const seedTestUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find default department and shift
    const defaultDept = await ctx.db.query("departments").first();
    const defaultShift = await ctx.db.query("shifts").first();
    if (!defaultDept || !defaultShift) {
      return { error: "Run seedAll first to create departments and shifts" };
    }

    const existingUsers = await ctx.db.query("users").collect();
    const existingEmails = new Set(existingUsers.map((u) => u.email).filter(Boolean));

    const results: string[] = [];

    // ─── Admin: Deepak Sharma ─────────────────────────────────
    if (!existingEmails.has("deepak.sharma@dejoiy.com")) {
      const adminUserId = await ctx.db.insert("users", {
        name: "Deepak Sharma",
        email: "deepak.sharma@dejoiy.com",
        role: "super_admin",
      });

      const empCount = await ctx.db.query("employees").collect();
      const empIdStr = generateEmployeeId(empCount.length + 1);

      const empId = await ctx.db.insert("employees", {
        userId: adminUserId,
        employeeId: empIdStr,
        firstName: "Deepak",
        lastName: "Sharma",
        email: "deepak.sharma@dejoiy.com",
        departmentId: defaultDept._id,
        joiningDate: now - 180 * 86400000,
        employmentStatus: "active",
        payType: "salary",
        monthlySalary: 120000,
        overtimeMultiplier: 1.5,
        holidayMultiplier: 2.0,
        timezone: "Asia/Kolkata",
        createdAt: now - 180 * 86400000,
        updatedAt: now,
      });

      await ctx.db.insert("shiftAssignments", {
        employeeId: empId,
        shiftId: defaultShift._id,
        startDate: now - 180 * 86400000,
        isActive: true,
        createdAt: now,
      });

      results.push(`Admin created: deepak.sharma@dejoiy.com (${empIdStr})`);
    } else {
      results.push("Admin already exists: deepak.sharma@dejoiy.com");
    }

    // ─── Employee: Raghvi Sharma ──────────────────────────────
    if (!existingEmails.has("raghvi.sharma@test.com")) {
      const empUserId = await ctx.db.insert("users", {
        name: "Raghvi Sharma",
        email: "raghvi.sharma@test.com",
        role: "employee",
      });

      const empCount = await ctx.db.query("employees").collect();
      const empIdStr = generateEmployeeId(empCount.length + 1);

      const empId = await ctx.db.insert("employees", {
        userId: empUserId,
        employeeId: empIdStr,
        firstName: "Raghvi",
        lastName: "Sharma",
        email: "raghvi.sharma@test.com",
        departmentId: defaultDept._id,
        teamId: (await ctx.db.query("teams").first())?._id,
        designationId: (await ctx.db.query("designations").first())?._id,
        joiningDate: now - 90 * 86400000,
        employmentStatus: "active",
        payType: "salary",
        monthlySalary: 55000,
        overtimeMultiplier: 1.5,
        holidayMultiplier: 2.0,
        timezone: "Asia/Kolkata",
        createdAt: now - 90 * 86400000,
        updatedAt: now,
      });

      await ctx.db.insert("shiftAssignments", {
        employeeId: empId,
        shiftId: defaultShift._id,
        startDate: now - 90 * 86400000,
        isActive: true,
        createdAt: now,
      });

      results.push(`Employee created: raghvi.sharma@test.com (${empIdStr})`);
    } else {
      results.push("Employee already exists: raghvi.sharma@test.com");
    }

    return { results };
  },
});

export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existingDepts = await ctx.db.query("departments").first();
    if (existingDepts) return { message: "Already seeded" };

    const now = Date.now();
    const today = new Date();

    // ─── Activity Types ───────────────────────────────────────
    const activities = [
      { name: "Customer Support", code: "SUPPORT", color: "#2d7a2d" },
      { name: "Sales", code: "SALES", color: "#2d6b9e" },
      { name: "Training", code: "TRAINING", color: "#c49a2c" },
      { name: "Meeting", code: "MEETING", color: "#6b5e9e" },
      { name: "Administration", code: "ADMIN", color: "#8b5e3c" },
      { name: "Quality Check", code: "QC", color: "#3c8b5e" },
      { name: "Project Work", code: "PROJECT", color: "#5e3c8b" },
      { name: "Internal Work", code: "INTERNAL", color: "#6b6b6b" },
    ];

    const activityIds: any[] = [];
    for (const a of activities) {
      const id = await ctx.db.insert("activityTypes", {
        ...a,
        isActive: true,
        createdAt: now,
      });
      activityIds.push(id);
    }

    // ─── Departments ──────────────────────────────────────────
    const departments = [
      { name: "Engineering", code: "ENG", description: "Software development and infrastructure" },
      { name: "Customer Support", code: "CS", description: "Customer service and support operations" },
      { name: "Sales & Marketing", code: "S&M", description: "Sales, marketing, and business development" },
      { name: "Human Resources", code: "HR", description: "People operations, hiring, and employee relations" },
    ];

    const deptIds: any[] = [];
    for (const d of departments) {
      const id = await ctx.db.insert("departments", {
        ...d,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      deptIds.push(id);
    }

    // ─── Teams ────────────────────────────────────────────────
    const teamData = [
      { name: "Frontend Team", code: "FE", deptIdx: 0 },
      { name: "Backend Team", code: "BE", deptIdx: 0 },
      { name: "Level 1 Support", code: "L1", deptIdx: 1 },
      { name: "Level 2 Support", code: "L2", deptIdx: 1 },
      { name: "Enterprise Sales", code: "ES", deptIdx: 2 },
    ];

    const teamIds: any[] = [];
    for (const t of teamData) {
      const id = await ctx.db.insert("teams", {
        name: t.name,
        code: t.code,
        departmentId: deptIds[t.deptIdx],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      teamIds.push(id);
    }

    // ─── Designations ─────────────────────────────────────────
    const designations = [
      { name: "Software Engineer", code: "SE", level: 3 },
      { name: "Senior Software Engineer", code: "SSE", level: 4 },
      { name: "Tech Lead", code: "TL", level: 5 },
      { name: "Support Agent", code: "SA", level: 2 },
      { name: "Senior Support Agent", code: "SSA", level: 3 },
      { name: "Sales Executive", code: "SLE", level: 3 },
      { name: "HR Manager", code: "HRM", level: 5 },
      { name: "Director", code: "DIR", level: 7 },
    ];

    const designationIds: any[] = [];
    for (const d of designations) {
      const id = await ctx.db.insert("designations", {
        ...d,
        isActive: true,
        createdAt: now,
      });
      designationIds.push(id);
    }

    // ─── Shifts ──────────────────────────────────────────────
    const shifts = [
      { name: "Morning Shift", code: "MS", startTime: "09:00", endTime: "18:00", days: [1, 2, 3, 4, 5] },
      { name: "Afternoon Shift", code: "AS", startTime: "14:00", endTime: "23:00", days: [1, 2, 3, 4, 5] },
      { name: "Night Shift", code: "NS", startTime: "22:00", endTime: "07:00", days: [1, 2, 3, 4, 5] },
      { name: "Weekend Shift", code: "WS", startTime: "10:00", endTime: "19:00", days: [0, 6] },
      { name: "Flexible", code: "FL", startTime: "08:00", endTime: "17:00", days: [1, 2, 3, 4, 5] },
    ];

    const shiftIds: any[] = [];
    for (const s of shifts) {
      const id = await ctx.db.insert("shifts", {
        name: s.name,
        code: s.code,
        startTime: s.startTime,
        endTime: s.endTime,
        isOvernight: s.code === "NS",
        gracePeriodMinutes: 15,
        minimumWorkingHours: 8,
        overtimeThresholdHours: 8,
        workingDays: s.days,
        breakMinutes: 60,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      shiftIds.push(id);
    }

    // ─── Employees (20 employees) ─────────────────────────────
    const employeeData = [
      { first: "James", last: "Mitchell", email: "james.m@company.com", dept: 0, team: 0, desig: 2, pay: "salary" as const, salary: 95000, shift: 0 },
      { first: "Sarah", last: "Chen", email: "sarah.c@company.com", dept: 0, team: 0, desig: 1, pay: "salary" as const, salary: 82000, shift: 0 },
      { first: "Michael", last: "Rodriguez", email: "michael.r@company.com", dept: 0, team: 1, desig: 1, pay: "salary" as const, salary: 85000, shift: 0 },
      { first: "Emily", last: "Watson", email: "emily.w@company.com", dept: 0, team: 1, desig: 0, pay: "salary" as const, salary: 75000, shift: 0 },
      { first: "David", last: "Kim", email: "david.k@company.com", dept: 0, team: 0, desig: 0, pay: "hourly" as const, rate: 45, shift: 0 },
      { first: "Lisa", last: "Johnson", email: "lisa.j@company.com", dept: 1, team: 2, desig: 4, pay: "salary" as const, salary: 58000, shift: 1 },
      { first: "Robert", last: "Brown", email: "robert.b@company.com", dept: 1, team: 2, desig: 3, pay: "hourly" as const, rate: 22, shift: 1 },
      { first: "Amanda", last: "Davis", email: "amanda.d@company.com", dept: 1, team: 2, desig: 3, pay: "hourly" as const, rate: 22, shift: 1 },
      { first: "Christopher", last: "Wilson", email: "chris.w@company.com", dept: 1, team: 3, desig: 3, pay: "hourly" as const, rate: 28, shift: 0 },
      { first: "Jessica", last: "Martinez", email: "jessica.m@company.com", dept: 1, team: 3, desig: 3, pay: "hourly" as const, rate: 28, shift: 1 },
      { first: "Daniel", last: "Anderson", email: "daniel.a@company.com", dept: 2, team: 4, desig: 5, pay: "salary" as const, salary: 72000, shift: 0 },
      { first: "Rachel", last: "Taylor", email: "rachel.t@company.com", dept: 2, team: 4, desig: 5, pay: "salary" as const, salary: 68000, shift: 0 },
      { first: "Andrew", last: "Thomas", email: "andrew.t@company.com", dept: 2, team: 4, desig: 5, pay: "hourly" as const, rate: 35, shift: 0 },
      { first: "Nicole", last: "Jackson", email: "nicole.j@company.com", dept: 3, team: undefined, desig: 6, pay: "salary" as const, salary: 88000, shift: 0 },
      { first: "Kevin", last: "White", email: "kevin.w@company.com", dept: 0, team: 0, desig: 0, pay: "hourly" as const, rate: 42, shift: 2 },
      { first: "Stephanie", last: "Harris", email: "stephanie.h@company.com", dept: 1, team: 2, desig: 3, pay: "hourly" as const, rate: 22, shift: 3 },
      { first: "Marcus", last: "Clark", email: "marcus.c@company.com", dept: 0, team: 1, desig: 0, pay: "salary" as const, salary: 78000, shift: 0 },
      { first: "Olivia", last: "Lewis", email: "olivia.l@company.com", dept: 2, team: 4, desig: 5, pay: "salary" as const, salary: 70000, shift: 0 },
      { first: "Brandon", last: "Walker", email: "brandon.w@company.com", dept: 1, team: 2, desig: 3, pay: "hourly" as const, rate: 22, shift: 0 },
      { first: "Natalie", last: "Hall", email: "natalie.h@company.com", dept: 0, team: 0, desig: 1, pay: "salary" as const, salary: 83000, shift: 0 },
    ];

    const empIds: any[] = [];
    for (let i = 0; i < employeeData.length; i++) {
      const e = employeeData[i];
      // Create user first
      const userId = await ctx.db.insert("users", {
        name: `${e.first} ${e.last}`,
        email: e.email,
        role: "employee",
      });

      const empId = await ctx.db.insert("employees", {
        userId,
        employeeId: `EMP${String(i + 1).padStart(4, "0")}`,
        firstName: e.first,
        lastName: e.last,
        email: e.email,
        departmentId: deptIds[e.dept],
        teamId: e.team !== undefined ? teamIds[e.team] : undefined,
        designationId: designationIds[e.desig],
        managerId: i >= 5 && i < 10 ? empIds[5] : i >= 10 && i < 13 ? empIds[10] : undefined,
        joiningDate: now - (180 + i * 30) * 86400000,
        employmentStatus: "active",
        payType: e.pay,
        hourlyRate: e.pay === "hourly" ? e.rate : undefined,
        monthlySalary: e.pay === "salary" ? e.salary : undefined,
        overtimeMultiplier: 1.5,
        holidayMultiplier: 2.0,
        timezone: "America/New_York",
        createdAt: now - (180 + i * 30) * 86400000,
        updatedAt: now,
      });

      empIds.push(empId);

      // Assign shift
      await ctx.db.insert("shiftAssignments", {
        employeeId: empId,
        shiftId: shiftIds[e.shift],
        startDate: now - (180 + i * 30) * 86400000,
        isActive: true,
        createdAt: now,
      });
    }

    // Set some managers
    await ctx.db.patch(deptIds[0], { managerId: empIds[0] });
    await ctx.db.patch(deptIds[1], { managerId: empIds[5] });
    await ctx.db.patch(deptIds[2], { managerId: empIds[10] });
    await ctx.db.patch(deptIds[3], { managerId: empIds[13] });

    // ─── Create HR Admin and Manager users ────────────────────
    const adminUserId = await ctx.db.insert("users", {
      name: "Admin User",
      email: "admin@company.com",
      role: "super_admin",
    });

    // ─── Attendance Records (last 7 days for first 15 employees) ─
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      date.setHours(0, 0, 0, 0);
      const dateNum = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends for most

      for (let empIdx = 0; empIdx < Math.min(15, empIds.length); empIdx++) {
        const emp = employeeData[empIdx];
        const shift = shifts[emp.shift];

        // Parse shift start/end
        const [startH, startM] = shift.startTime.split(":").map(Number);
        const [endH, endM] = shift.endTime.split(":").map(Number);

        // Add some randomness
        const lateByMinutes = empIdx % 3 === 0 ? Math.floor(Math.random() * 30) : 0;
        const earlyByMinutes = empIdx % 5 === 0 ? Math.floor(Math.random() * 30) : 0;

        const clockInTime = new Date(date);
        clockInTime.setHours(startH, startM + lateByMinutes, 0, 0);

        const clockOutTime = new Date(date);
        if (shift.code === "NS") {
          // Night shift goes to next day
          clockOutTime.setDate(clockOutTime.getDate() + 1);
        }
        clockOutTime.setHours(endH, endM - earlyByMinutes, 0, 0);

        const grossMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000);
        const breakMin = Math.floor(Math.random() * 2) * 15 + 30; // 30 or 45 min break
        const netMinutes = Math.max(0, grossMinutes - breakMin);
        const overtimeMinutes = Math.max(0, netMinutes - 480); // 8 hours threshold

        let status: any = "shift_completed";
        if (lateByMinutes > 15) status = "late";
        if (overtimeMinutes > 0) status = "overtime";
        if (earlyByMinutes > 30 && netMinutes < 420) status = "early_leave";

        const sessionId = await ctx.db.insert("attendanceSessions", {
          employeeId: empIds[empIdx],
          shiftId: shiftIds[emp.shift],
          date: dateNum,
          clockIn: clockInTime.getTime(),
          clockOut: clockOutTime.getTime(),
          scheduledStart: shift.startTime,
          scheduledEnd: shift.endTime,
          status,
          grossMinutes,
          breakMinutes: breakMin,
          netMinutes,
          overtimeMinutes,
          isLate: lateByMinutes > 15,
          lateMinutes: lateByMinutes > 15 ? lateByMinutes : undefined,
          isEarlyLeave: earlyByMinutes > 30 && netMinutes < 420,
          earlyLeaveMinutes: earlyByMinutes > 30 && netMinutes < 420 ? earlyByMinutes : undefined,
          createdAt: clockInTime.getTime(),
          updatedAt: clockOutTime.getTime(),
        });

        // Add break records
        const breakStart = new Date(clockInTime);
        breakStart.setHours(12, 30, 0, 0);
        const breakEnd = new Date(breakStart);
        breakEnd.setMinutes(breakEnd.getMinutes() + breakMin);

        await ctx.db.insert("breakSessions", {
          attendanceSessionId: sessionId,
          employeeId: empIds[empIdx],
          breakStart: breakStart.getTime(),
          breakEnd: breakEnd.getTime(),
          durationMinutes: breakMin,
          createdAt: breakStart.getTime(),
        });

        // Add activity sessions
        const act1End = new Date(breakStart);
        act1End.setHours(10, 30, 0, 0);
        await ctx.db.insert("activitySessions", {
          attendanceSessionId: sessionId,
          employeeId: empIds[empIdx],
          activityTypeId: activityIds[empIdx % activityIds.length],
          startTime: clockInTime.getTime(),
          endTime: act1End.getTime(),
          durationMinutes: Math.round((act1End.getTime() - clockInTime.getTime()) / 60000),
          createdAt: clockInTime.getTime(),
        });

        await ctx.db.insert("activitySessions", {
          attendanceSessionId: sessionId,
          employeeId: empIds[empIdx],
          activityTypeId: activityIds[(empIdx + 2) % activityIds.length],
          startTime: act1End.getTime(),
          endTime: breakStart.getTime(),
          durationMinutes: Math.round((breakStart.getTime() - act1End.getTime()) / 60000),
          createdAt: act1End.getTime(),
        });
      }
    }

    // ─── Correction Tickets ───────────────────────────────────
    const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    await ctx.db.insert("correctionTickets", {
      ticketId: "TC-20260901-A1B2",
      employeeId: empIds[2],
      date: todayNum - 1,
      correctionType: "missing_clock_out",
      requestedValue: "2026-09-03T18:15:00Z",
      reason: "Forgot to clock out yesterday, left at 6:15 PM",
      status: "pending",
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    });

    await ctx.db.insert("correctionTickets", {
      ticketId: "TC-20260901-C3D4",
      employeeId: empIds[6],
      date: todayNum - 2,
      correctionType: "wrong_clock_in",
      originalValue: "2026-09-02T14:45:00Z",
      requestedValue: "2026-09-02T14:00:00Z",
      reason: "Clock-in was recorded late but I arrived at 2:00 PM",
      status: "approved",
      reviewerId: empIds[5],
      reviewedAt: now - 172800000,
      reviewNote: "Approved - verified with badge records",
      createdAt: now - 172800000,
      updatedAt: now - 172800000,
    });

    // ─── Payroll Periods ──────────────────────────────────────
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    await ctx.db.insert("payrollPeriods", {
      name: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
      startDate: new Date(currentYear, currentMonth, 1).getTime(),
      endDate: new Date(currentYear, currentMonth + 1, 0).getTime(),
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("payrollPeriods", {
      name: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
      startDate: new Date(currentYear, currentMonth - 1, 1).getTime(),
      endDate: new Date(currentYear, currentMonth, 0).getTime(),
      status: "locked",
      totalEmployees: 20,
      totalRegularHours: 2640,
      totalOvertimeHours: 180,
      totalGrossPay: 185000,
      totalNetPay: 185000,
      calculatedBy: adminUserId,
      calculatedAt: now - 86400000 * 10,
      approvedBy: adminUserId,
      approvedAt: now - 86400000 * 5,
      lockedBy: adminUserId,
      lockedAt: now - 86400000 * 3,
      createdAt: now - 86400000 * 30,
      updatedAt: now - 86400000 * 3,
    });

    // ─── Holidays ─────────────────────────────────────────────
    await ctx.db.insert("holidays", {
      name: "New Year's Day",
      date: new Date(currentYear, 0, 1).getTime(),
      year: currentYear,
      isRecurring: true,
      description: "Public holiday",
      createdAt: now,
    });

    await ctx.db.insert("holidays", {
      name: "Independence Day",
      date: new Date(currentYear, 6, 4).getTime(),
      year: currentYear,
      isRecurring: true,
      description: "Public holiday",
      createdAt: now,
    });

    await ctx.db.insert("holidays", {
      name: "Labor Day",
      date: new Date(currentYear, 8, 1).getTime(),
      year: currentYear,
      isRecurring: false,
      description: "Federal holiday",
      createdAt: now,
    });

    // ─── System Settings ──────────────────────────────────────
    const settings = [
      { key: "company_name", value: "Freebuff Timekeeping", description: "Company name" },
      { key: "timezone", value: "America/New_York", description: "Default timezone" },
      { key: "currency", value: "USD", description: "Payroll currency" },
      { key: "working_week", value: "mon-fri", description: "Standard working week" },
      { key: "grace_period", value: "15", description: "Grace period in minutes" },
      { key: "overtime_threshold", value: "480", description: "Overtime threshold in minutes" },
      { key: "break_duration", value: "60", description: "Standard break duration in minutes" },
    ];

    for (const s of settings) {
      await ctx.db.insert("systemSettings", {
        ...s,
        updatedAt: now,
      });
    }

    // ─── Audit Logs ───────────────────────────────────────────
    const actions = ["shift_started", "shift_ended", "break_started", "break_ended", "login", "employee_created"];
    for (let i = 0; i < 30; i++) {
      const actionIdx = i % actions.length;
      const empIdx = i % Math.min(10, empIds.length);
      const empRec = await ctx.db.get(empIds[empIdx]);
      const uid = (empRec as any)?.userId ?? adminUserId;
      await ctx.db.insert("auditLogs", {
        userId: uid,
        userRole: "employee",
        action: actions[actionIdx],
        entity: "attendanceSession",
        timestamp: now - i * 3600000 * Math.random() * 24,
      });
    }

    return { message: "Seed data created successfully" };
  },
});
