import fixture from "./fixtures/responsiveSchedule.json";
import { parseResponsiveSessions } from "../parsers";

describe("parseResponsiveSessions", () => {
  const sessions = parseResponsiveSessions(fixture);

  test("drops sessions with no offerings and sorts the rest by date", () => {
    expect(sessions.map((s) => s.id)).toEqual(["2001", "2002"]);
  });

  test("keeps the district-local calendar day from IC's timestamp", () => {
    expect(sessions[0].startDate).toBe("2026-10-29");
    expect(sessions[0].name).toBe("Thursday ACCESS; Thu 10/29/2026");
    expect(sessions[0].isOpen).toBe(false);
    expect(sessions[1].isOpen).toBe(true);
  });

  test("sorts offerings by name, case-insensitively", () => {
    expect(sessions[1].offerings.map((o) => o.name)).toEqual(["Chemistry Help", "study Hall"]);
  });

  test("marks the offering with a rosterID as the student's selection", () => {
    const selected = sessions[0].selectedOffering;
    expect(selected?.id).toBe("9002");
    expect(selected?.isSelected).toBe(true);
    expect(selected?.teacherAssigned).toBe(true);
    expect(selected?.teacherReason).toBe("Missing unit test");
    expect(sessions[1].selectedOffering).toBeNull();
  });

  test("computes seats left, never below zero", () => {
    const [chem, studyHall] = sessions[1].offerings;
    expect(chem.seatsLeft).toBe(7);
    expect(studyHall.seatsLeft).toBe(0);
  });

  test("turns empty strings into null", () => {
    const art = sessions[0].offerings.find((o) => o.id === "9001")!;
    expect(art.description).toBe("Extra time to work on projects.");
    expect(sessions[1].offerings[1].description).toBeNull();
    expect(art.teacher).toBe("Teacher, Delta");
    expect(art.room).toBe("D-404");
  });

  test("tolerates missing capacity and malformed input", () => {
    const [s] = parseResponsiveSessions([
      { responsiveSessionID: 1, offerings: [{ responsiveOfferingID: 5, responsiveOfferingName: "X" }] },
    ]);
    expect(s.offerings[0].seatsLeft).toBeNull();
    expect(s.startDate).toBeNull();
    expect(parseResponsiveSessions(null)).toEqual([]);
    expect(parseResponsiveSessions({ data: "nope" })).toEqual([]);
    expect(parseResponsiveSessions([{ offerings: [] }, "junk"])).toEqual([]);
  });
});
