export type MuscleId =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "traps"
  | "lats"
  | "upper_back"
  | "lower_back"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "hip_flexors"
  | "calves";

export const MUSCLE_NAMES: Record<MuscleId, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  traps: "Traps",
  lats: "Lats",
  upper_back: "Upper back",
  lower_back: "Lower back",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  adductors: "Inner thighs",
  hip_flexors: "Hip flexors",
  calves: "Calves",
};

// Free-text muscle group → muscles. Order matters: more specific phrases first.
const RULES: [RegExp, MuscleId[]][] = [
  [/full[\s-]?body|total body/i, ["chest", "shoulders", "quads", "glutes", "abs", "triceps", "hamstrings"]],
  [/upper back|rhomboid|rear delt/i, ["upper_back"]],
  [/lower back|erector|spinal/i, ["lower_back"]],
  [/hip flexor/i, ["hip_flexors"]],
  [/inner thigh|adductor/i, ["adductors"]],
  [/chest|pec/i, ["chest"]],
  [/shoulder|delt/i, ["shoulders"]],
  [/bicep/i, ["biceps"]],
  [/tricep/i, ["triceps"]],
  [/forearm|grip|wrist/i, ["forearms"]],
  [/oblique/i, ["obliques"]],
  [/\babs?\b|abdominal|six[\s-]?pack/i, ["abs"]],
  [/core/i, ["abs", "obliques"]],
  [/trap/i, ["traps"]],
  [/\blats?\b|latissimus/i, ["lats"]],
  [/\bback\b/i, ["lats", "upper_back"]],
  [/glute|butt|hip/i, ["glutes"]],
  [/quad/i, ["quads"]],
  [/hamstring/i, ["hamstrings"]],
  [/calf|calves/i, ["calves"]],
  [/\blegs?\b|lower body/i, ["quads", "glutes", "hamstrings", "calves"]],
  [/\barms?\b/i, ["biceps", "triceps"]],
];

function musclesFor(group: string): MuscleId[] {
  for (const [re, ids] of RULES) if (re.test(group)) return ids;
  return [];
}

/** Primary muscles come from the first listed groups; the rest are secondary. */
export function exerciseMuscles(groups: string[], primaryCount = 1): { primary: MuscleId[]; secondary: MuscleId[] } {
  const primary = new Set<MuscleId>();
  const secondary = new Set<MuscleId>();
  groups.forEach((g, i) => musclesFor(g).forEach((m) => (i < primaryCount ? primary : secondary).add(m)));
  primary.forEach((m) => secondary.delete(m));
  return { primary: [...primary], secondary: [...secondary] };
}
