import type { GermanVerb } from "@shared";

export const b2Verbs: GermanVerb[] = [
  {
    infinitive: "bewerten",
    english: "to evaluate/assess",
    präteritum: "bewertete",
    partizipII: "bewertet",
    auxiliary: "haben",
    level: "B2",
    präteritumExample: "Der Professor bewertete die Arbeiten.",
    partizipIIExample: "Die Jury hat die Leistungen bewertet.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" }
  },
  {
    infinitive: "übertragen",
    english: "to transfer/transmit",
    präteritum: "übertrug",
    partizipII: "übertragen",
    auxiliary: "haben",
    level: "B2",
    präteritumExample: "Er übertrug die Verantwortung.",
    partizipIIExample: "Die Krankheit hat sich schnell übertragen.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" },
    pattern: { type: "ablaut", group: "a -> u -> a" }
  },
  {
    infinitive: "durchführen",
    english: "to carry out/conduct",
    präteritum: "führte durch",
    partizipII: "durchgeführt",
    auxiliary: "haben",
    level: "B2",
    präteritumExample: "Das Team führte das Experiment durch.",
    partizipIIExample: "Sie haben eine Studie durchgeführt.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" }
  },
  {
    infinitive: "erörtern",
    english: "to discuss/debate",
    präteritum: "erörterte",
    partizipII: "erörtert",
    auxiliary: "haben",
    level: "B2",
    präteritumExample: "Das Gremium erörterte die Vorschläge.",
    partizipIIExample: "Die Experten haben die Problematik erörtert.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" }
  },
  {
    infinitive: "suggerieren",
    english: "to suggest/imply",
    präteritum: "suggerierte",
    partizipII: "suggeriert",
    auxiliary: "haben",
    level: "B2",
    präteritumExample: "Der Text suggerierte eine andere Interpretation.",
    partizipIIExample: "Die Studie hat einen Zusammenhang suggeriert.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" }
  },
  {
    infinitive: "gedeihen",
    english: "to thrive/flourish",
    präteritum: "gedieh",
    partizipII: "gediehen",
    auxiliary: "sein",
    level: "B2",
    präteritumExample: "Das Unternehmen gedieh unter seiner Führung.",
    partizipIIExample: "Die Pflanzen sind prächtig gediehen.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" },
    pattern: { type: "ablaut", group: "ei -> ie -> ie" }
  },
  {
    infinitive: "differenzieren",
    english: "to differentiate",
    präteritum: "differenzierte",
    partizipII: "differenziert",
    auxiliary: "haben",
    level: "B2",
    präteritumExample: "Der Experte differenzierte zwischen den Konzepten.",
    partizipIIExample: "Sie hat genau zwischen den Optionen differenziert.",
    source: { name: "Duden", levelReference: "B2 Advanced Verbs" }
  }
];
