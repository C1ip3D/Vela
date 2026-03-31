import catalogJson from "@/data/district_course_catalog.json";

interface CatalogCourse {
  id: string;
  prerequisites: string[];
}

const catalog = (catalogJson as { courses: CatalogCourse[] }).courses;
const catalogMap = new Map(catalog.map((c) => [c.id, c]));

/**
 * Maps a Canvas course name to a DUSD catalog ID using keyword matching.
 * Returns null if no match is found.
 */
export function mapCourseNameToCatalogId(name: string): string | null {
  const n = name.toLowerCase().trim();

  // ── Mathematics ──────────────────────────────────────────────────────────
  if (n.includes("ap calculus bc"))                                   return "APCALCBC";
  if (n.includes("ap calculus ab"))                                   return "APCALCAB";
  if (n.includes("ap precalculus") || n.includes("ap pre-calc"))      return "APPRECALC";
  if (n.includes("ap statistics") || n.includes("ap stats"))          return "APSTATS";
  if (/\bcalculus\b/.test(n) && !n.includes("ap"))                    return "CALCULUS";
  if (/pre[-\s]?calc/.test(n) && !n.includes("ap"))                   return "PRECALC";
  if (n.includes("trigonometry") || n.includes("trig"))               return "TRIGOTHER";
  if ((n.includes("adv") || n.includes("advanced")) &&
      n.includes("algebra") && /2|ii/.test(n))                       return "ADVALGEBRA2";
  if (n.includes("algebra") && /2|ii/.test(n))                        return "ALGEBRA2";
  if (n.includes("algebra") && /1b|1 b/.test(n))                      return "ALGEBRA1B";
  if (n.includes("algebra") && /1|i/.test(n))                         return "ALGEBRA1";
  if (n.includes("geometry"))                                          return "GEOMETRY";
  if (n.includes("statistics") || n.includes("stats"))                return "STATS";
  if (n.includes("financial app"))                                     return "FINANCIALAPP";

  // ── Science ───────────────────────────────────────────────────────────────
  if (n.includes("ap physics c"))                                      return "APPHYSC";
  if (n.includes("ap physics 1") || n.includes("ap physics i"))       return "APPHYS1";
  if (n.includes("ap environmental") || n.includes("ap envs"))        return "APENVS";
  if (n.includes("ap biology") || n.includes("ap bio"))               return "APBIO";
  if (n.includes("ap chemistry") || n.includes("ap chem"))            return "APCHEM";
  if (n.includes("honors chemistry") || n.includes("hon chem"))       return "HONCHEMISTRY";
  if (n.includes("honors physics") || n.includes("hon phys"))         return "HONPHYSICS";
  if (n.includes("honors anatomy"))                                    return "HONANATOMY";
  if (n.includes("biomedical innovations"))                            return "BIOMEDINNOV";
  if (n.includes("biotechnology"))                                     return "BIOTECHNOLOGY";
  if (n.includes("anatomy and physiology") ||
      n.includes("anatomy & physiology"))                              return "ANATOMYPHYS";
  if (n.includes("marine science"))                                    return "MARINESCI";
  if (n.includes("forensics"))                                         return "FORENSICS";
  if (n.includes("physics in the universe"))                           return "PHYSUNIVERSE";
  if (n.includes("earth and space") || n.includes("earth & space"))   return "EARTHSPACE";
  if (n.includes("chemistry") && !n.includes("ap"))                   return "CHEMISTRY";
  if (n.includes("physics") && !n.includes("ap"))                     return "PHYSICS";
  if (n.includes("biology") && !n.includes("ap"))                     return "BIOLOGY";

  // ── English ───────────────────────────────────────────────────────────────
  if (n.includes("ap english lit") || n.includes("ap literature") ||
      (n.includes("ap english") && /12|comp/.test(n)))                return "ENGAP12";
  if (n.includes("ap english lang") || n.includes("ap language") ||
      (n.includes("ap english") && /11/.test(n)))                     return "ENGAP11";
  if (n.includes("english") && /4|iv|12/.test(n))                     return "ENG4ERWC";
  if (n.includes("english") && (/3|iii|11/.test(n)) && n.includes("adv")) return "ENG3ADV";
  if (n.includes("english") && /3|iii|11/.test(n))                    return "ENG3";
  if (n.includes("english") && /2|ii|10/.test(n) && n.includes("adv")) return "ENG2ADV";
  if (n.includes("english") && /2|ii|10/.test(n))                     return "ENG2";
  if (n.includes("english") && /1|i|9/.test(n) && n.includes("adv")) return "ENG1ADV";
  if (n.includes("english") && /1|i|9/.test(n))                       return "ENG1";

  // ── History / Social Science ──────────────────────────────────────────────
  if (n.includes("ap us history") || n.includes("apush") ||
      n.includes("ap u.s. history"))                                   return "APUSHIST";
  if (n.includes("ap world history"))                                  return "WORLDHIST"; // fallback
  if (n.includes("ap human geography"))                                return "APHUMANGEOG";
  if (n.includes("ap gov") || n.includes("ap government") ||
      n.includes("ap us gov") || n.includes("ap united states gov"))  return "APCIVICS";
  if (n.includes("ap macroeconomics") || n.includes("ap macro"))      return "APMACRO";
  if (n.includes("ap microeconomics") || n.includes("ap micro"))      return "APMICRO";
  if (n.includes("ap psychology") || n.includes("ap psych"))          return "APPSYCH";
  if (n.includes("us history") || n.includes("u.s. history"))         return "USHIST";
  if (n.includes("world history"))                                     return "WORLDHIST";
  if (n.includes("economics"))                                         return "ECONOMICS";
  if (n.includes("civics"))                                            return "CIVICS";
  if (n.includes("psychology"))                                        return "PSYCH";
  if (n.includes("law and society") || n.includes("law & society"))   return "LAW";

  // ── Engineering / CS ──────────────────────────────────────────────────────
  if (n.includes("ap computer science a") ||
      n.includes("ap csa") || n.includes("ap comp sci a"))            return "PLTW_CSA";
  if (n.includes("ap computer science principles") ||
      n.includes("ap csp") || n.includes("ap comp sci principles"))   return "PLTW_CSP";
  if (n.includes("computer science essentials") || n.includes("cse")) return "PLTW_CSE";
  if (n.includes("computer science") || n.includes("comp sci"))       return "PLTW_CSE";
  if (n.includes("cybersecurity"))                                     return "CYBERSEC";
  if (n.includes("principles of engineering") || n.includes("poe"))   return "PLTW_POE";
  if (n.includes("intro") && n.includes("engineering"))               return "PLTW_IED";
  if (n.includes("civil engineering"))                                 return "ROP_CEA";
  if (n.includes("digital electronics"))                               return "PLTW_DE";

  // ── Performing Arts ───────────────────────────────────────────────────────
  if (n.includes("ap music theory"))                                   return "APMUSICTHEORY";
  if (n.includes("chamber") && n.includes("vocal"))                   return "CHAMVOCAL";
  if (n.includes("chamber") && n.includes("orch"))                    return "CHAMORCH";
  if (n.includes("show choir"))                                        return "SHOWCHOIR";
  if (n.includes("jazz"))                                              return "JAZZENSEMBLE";
  if (n.includes("wind ensemble"))                                     return "WINDENSEMBLE";
  if (n.includes("symphonic band"))                                    return "SYMPBAND";
  if (n.includes("orchestra"))                                         return "ORCHESTRA";
  if (n.includes("honors drama") || /drama\s*3/.test(n))              return "DRAMA3H";
  if (/drama\s*2/.test(n))                                             return "DRAMA2";
  if (/drama\s*1/.test(n))                                             return "DRAMA1";
  if (n.includes("improv"))                                            return "IMPROV";
  if (n.includes("musical theatre"))                                   return "MUSICALTHEATRE";
  if (n.includes("concert choir") || n.includes("adv choir") ||
      n.includes("advanced choir"))                                    return "ADVCHOIR";
  if (n.includes("choir"))                                             return "CHOIR";

  // ── PE ────────────────────────────────────────────────────────────────────
  if (n.includes("dance") && /1|i/.test(n))                           return "DANCE1PE";
  if (n.includes("dance") && /2|ii/.test(n))                          return "DANCE2PE";
  if (n.includes("dance") && /3|iii/.test(n))                         return "DANCE3PE";
  if (n.includes("weight"))                                            return "WEIGHTPE";
  if (n.includes("running") || n.includes("run for fit"))             return "RUNFIT";
  if (n.includes("team sports"))                                       return "TEAMPE";
  if (n.includes("freshman") && n.includes("pe"))                     return "PE9";

  return null;
}

/**
 * Given a set of current catalog course IDs, recursively walks prerequisites
 * to build a best-effort set of completed course IDs.
 * Handles OR-syntax prereqs like "ALGEBRA2|ADVALGEBRA2".
 */
export function inferCompletedFromCurrent(currentIds: string[]): string[] {
  const completed = new Set<string>();

  function addPrereqs(id: string) {
    const course = catalogMap.get(id);
    if (!course) return;
    for (const prereq of course.prerequisites) {
      // OR condition — pick all alternatives as potentially completed
      for (const alt of prereq.split("|")) {
        if (!completed.has(alt)) {
          completed.add(alt);
          addPrereqs(alt);
        }
      }
    }
  }

  for (const id of currentIds) {
    addPrereqs(id);
  }

  return [...completed];
}

/**
 * Converts an array of Canvas NormalizedCourse objects into
 * { currentCourseIds, completedCourseIds, courseGrades } ready for the recommender.
 */
export function buildStudentProfile(
  courses: Array<{ id: string; name: string; letterGrade: string | null; currentGrade: number | null }>
) {
  const currentCourseIds: string[] = [];
  const courseGrades: Record<string, { letter: string; percentage: number }> = {};

  for (const c of courses) {
    const catalogId = mapCourseNameToCatalogId(c.name);
    if (catalogId) {
      currentCourseIds.push(catalogId);
      courseGrades[catalogId] = {
        letter: c.letterGrade ?? "B",
        percentage: c.currentGrade ?? 85,
      };
    }
  }

  const completedCourseIds = inferCompletedFromCurrent(currentCourseIds);

  return { currentCourseIds, completedCourseIds, courseGrades };
}
