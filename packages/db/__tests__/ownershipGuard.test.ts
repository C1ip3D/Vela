import { assertOwnershipFilter, MissingOwnershipFilterError } from "../ownershipGuard";

describe("assertOwnershipFilter", () => {
  it("throws when a guarded model's query has no userId filter", () => {
    expect(() => assertOwnershipFilter("Enrollment", "findMany", { where: { isActive: true } })).toThrow(
      MissingOwnershipFilterError
    );
  });

  it("throws when a guarded model's query has no where at all", () => {
    expect(() => assertOwnershipFilter("Enrollment", "findMany", {})).toThrow(MissingOwnershipFilterError);
  });

  it("passes when userId is present at the top level of where", () => {
    expect(() =>
      assertOwnershipFilter("Enrollment", "findFirst", { where: { id: "e1", userId: "u1" } })
    ).not.toThrow();
  });

  it("passes for a compound-unique where shape (AssignmentGrade)", () => {
    expect(() =>
      assertOwnershipFilter("AssignmentGrade", "findUnique", {
        where: { userId_courseId_assignmentKey: { userId: "u1", courseId: "c1", assignmentKey: "a1" } },
      })
    ).not.toThrow();
  });

  it("throws for a compound-unique where shape missing userId", () => {
    expect(() =>
      assertOwnershipFilter("AssignmentGrade", "findUnique", {
        where: { courseId_assignmentKey: { courseId: "c1", assignmentKey: "a1" } },
      })
    ).toThrow(MissingOwnershipFilterError);
  });

  it("does not guard unowned models (Course, District, User) regardless of where", () => {
    expect(() => assertOwnershipFilter("Course", "findMany", {})).not.toThrow();
    expect(() => assertOwnershipFilter("District", "findFirst", { where: {} })).not.toThrow();
    expect(() => assertOwnershipFilter("User", "findUnique", { where: { firebaseUid: "abc" } })).not.toThrow();
  });

  it("never guards create/createMany even without userId in data", () => {
    expect(() => assertOwnershipFilter("Enrollment", "create", { data: { courseId: "c1" } })).not.toThrow();
    expect(() => assertOwnershipFilter("Enrollment", "createMany", { data: [{ courseId: "c1" }] })).not.toThrow();
  });

  it("guards upsert by its where, ignoring create/update payloads", () => {
    expect(() =>
      assertOwnershipFilter("Enrollment", "upsert", {
        where: { icEnrollmentId: "e1", userId: "u1" },
        create: { courseId: "c1", userId: "u1", icEnrollmentId: "e1", enrolledAt: new Date() },
        update: { currentGrade: 90 },
      })
    ).not.toThrow();

    expect(() =>
      assertOwnershipFilter("Enrollment", "upsert", {
        where: { icEnrollmentId: "e1" },
        create: { courseId: "c1", userId: "u1", icEnrollmentId: "e1", enrolledAt: new Date() },
        update: { currentGrade: 90 },
      })
    ).toThrow(MissingOwnershipFilterError);
  });

  it("guards groupBy and aggregate the same as findMany", () => {
    expect(() => assertOwnershipFilter("GradeHistory", "groupBy", { where: {} })).toThrow(
      MissingOwnershipFilterError
    );
    expect(() =>
      assertOwnershipFilter("GradeHistory", "aggregate", { where: { userId: "u1" } })
    ).not.toThrow();
  });

  it("ignores operations with no model (e.g. $queryRaw) — known accepted gap", () => {
    expect(() => assertOwnershipFilter(undefined, "queryRaw", {})).not.toThrow();
  });
});
