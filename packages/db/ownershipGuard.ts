import { Prisma } from "@prisma/client";

/**
 * Thrown when a query against a user-owned model (see OWNED_MODELS below)
 * doesn't filter by that model's owner field. This is a code bug, not a
 * runtime condition callers should catch and handle — it exists to fail
 * loudly in development/tests rather than silently return or mutate rows
 * across users.
 */
export class MissingOwnershipFilterError extends Error {
  constructor(model: string, operation: string) {
    super(
      `Query "${operation}" on "${model}" is missing its required ownership filter. ` +
        `Every query against a user-owned model must filter by its owner field — see packages/db/ownershipGuard.ts.`
    );
    this.name = "MissingOwnershipFilterError";
  }
}

// Models scoped to a single user, and the field that owns them. This is an
// app-layer safety net against a future query that forgets to scope by
// user — deliberately NOT Postgres RLS (no DB roles, no session
// variables, no SET LOCAL). User/Course/District are excluded: User *is*
// the identity, Course/District are district-scoped, not user-scoped.
const OWNED_MODELS: Record<string, string> = {
  Enrollment: "userId",
  GradeHistory: "userId",
  GpaSnapshot: "userId",
  AdvisorLog: "userId",
  AssignmentGrade: "userId",
};

// Operations that accept a `where` and must be checked. create/createMany
// are intentionally excluded: they have no `where`, and the schema's
// `userId String` NOT NULL column already forces a value at creation.
// upsert inspects `args.where` only (not `args.create`), same reasoning.
const GUARDED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * True if `where` filters by `ownerField` directly, or via a compound
 * unique selector one level down (e.g.
 * `{ userId_courseId_assignmentKey: { userId, courseId, assignmentKey } }`)
 * — the shape Prisma generates for AssignmentGrade's `@@unique`.
 *
 * Known accepted gaps (per the ownership-guard decision, not bugs to fix
 * here): a `userId` filter nested inside a *relation's* own `where`
 * (e.g. `{ course: { ... } }`) isn't detected, and this offers no
 * protection against `$queryRaw`/`$executeRaw` (none exist in this
 * codebase today).
 */
function whereHasOwnerField(where: unknown, ownerField: string): boolean {
  if (!where || typeof where !== "object") return false;
  const w = where as Record<string, unknown>;
  if (ownerField in w) return true;
  return Object.values(w).some(
    (v) => v && typeof v === "object" && !Array.isArray(v) && ownerField in (v as Record<string, unknown>)
  );
}

/**
 * The guard's actual decision logic, pulled out of the Prisma extension
 * wrapper so it's directly unit-testable without needing a live
 * PrismaClient bound to a real database. Throws MissingOwnershipFilterError
 * or returns normally — never mutates or inspects `args` otherwise.
 */
export function assertOwnershipFilter(model: string | undefined, operation: string, args: unknown): void {
  const ownerField = model ? OWNED_MODELS[model] : undefined;
  if (!ownerField || !GUARDED_OPERATIONS.has(operation)) return;

  const where = (args as { where?: unknown } | undefined)?.where;
  if (!whereHasOwnerField(where, ownerField)) {
    throw new MissingOwnershipFilterError(model as string, operation);
  }
}

export const ownershipGuardExtension = Prisma.defineExtension({
  name: "ownershipGuard",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        assertOwnershipFilter(model, operation, args);
        return query(args);
      },
    },
  },
});
