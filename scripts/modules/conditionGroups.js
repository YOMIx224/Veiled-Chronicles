export const CONDITION_GROUPS = [
  {
    key: "injuries", label: "Injuries",
    statusMap: { bleeding: "bleeding", heavyBleeding: "bleeding" },
    entries: [
      ["bruising", "Bruising"],
      ["internalBruising", "Internal Bruising"],
      ["brokenBone", "Broken Bone"],
      ["minorWound", "Minor Wound"],
      ["deepWound", "Deep Wound"],
      ["punctureWound", "Puncture Wound"],
      ["seriousInjury", "Serious Injury"],
      ["bleeding", "Bleeding"],
      ["heavyBleeding", "Heavy Bleeding"],
    ],
  },
  {
    key: "psychiatricDisorders", label: "Psychiatric Disorders",
    statusMap: { schizophrenia: "confused", ptsd: "fear" },
    entries: [
      ["depression", "Depression"],
      ["panicDisorder", "Panic Disorder"],
      ["schizophrenia", "Schizophrenia"],
      ["ptsd", "PTSD"],
      ["specificPhobia", "Specific Phobia"],
    ],
  },
];
