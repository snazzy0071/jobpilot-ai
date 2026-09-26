// Critical thinking practice in the five standard argument-analysis formats (inference, recognising assumptions,
// deduction, interpretation, evaluating arguments). Every passage, statement and explanation below is original to this
// file — invented organisations and figures, written for this product. Nothing is adapted from any published assessment.
//
// Conventions used in the explanations (stated in the pack descriptions too):
//   - answer only from the passage; ignore what you happen to know
//   - "Probably true/false" = more likely than not from the passage, but not certain
//   - "Insufficient data" = the passage doesn't let you tell

const INFERENCE_OPTIONS = ["True", "Probably true", "Insufficient data", "Probably false", "False"];
const ASSUMPTION_OPTIONS = ["Assumption made", "Assumption not made"];
const CONCLUSION_OPTIONS = ["Conclusion follows", "Conclusion does not follow"];
const ARGUMENT_OPTIONS = ["Strong argument", "Weak argument"];

const inference = (passage, statement, correct, why, difficulty = "medium") => ({
  pack: "assessing-inferences",
  subtype: "Inference",
  difficulty,
  stimulus: passage,
  prompt: `Inference: "${statement}"\n\nHow should this inference be rated, based only on the passage?`,
  options: INFERENCE_OPTIONS,
  correct,
  explanation: why,
});

const assumption = (statement, proposed, made, why, difficulty = "medium") => ({
  pack: "recognising-assumptions",
  subtype: "Recognising assumptions",
  difficulty,
  stimulus: `Statement: "${statement}"`,
  prompt: `Proposed assumption: "${proposed}"\n\nIs this assumption made in the statement?`,
  options: ASSUMPTION_OPTIONS,
  correct: made ? "Assumption made" : "Assumption not made",
  explanation: why,
});

const deduction = (premises, conclusion, follows, why, difficulty = "medium") => ({
  pack: "making-deductions",
  subtype: "Deduction",
  difficulty,
  stimulus: premises,
  prompt: `Conclusion: "${conclusion}"\n\nDoes the conclusion follow necessarily from the statements above? Treat the statements as true, even if they are not in real life.`,
  options: CONCLUSION_OPTIONS,
  correct: follows ? "Conclusion follows" : "Conclusion does not follow",
  explanation: why,
});

const interpretation = (passage, conclusion, follows, why, difficulty = "medium") => ({
  pack: "interpreting-information",
  subtype: "Interpretation",
  difficulty,
  stimulus: passage,
  prompt: `Conclusion: "${conclusion}"\n\nDoes the conclusion follow beyond reasonable doubt from the information in the passage?`,
  options: CONCLUSION_OPTIONS,
  correct: follows ? "Conclusion follows" : "Conclusion does not follow",
  explanation: why,
});

const argument = (question, text, strong, why, difficulty = "medium") => ({
  pack: "evaluating-arguments",
  subtype: "Evaluating arguments",
  difficulty,
  stimulus: `Question: ${question}`,
  prompt: `Argument: "${text}"\n\nIs this a strong or a weak argument? A strong argument is both important and directly related to the question; treat every argument as true.`,
  options: ARGUMENT_OPTIONS,
  correct: strong ? "Strong argument" : "Weak argument",
  explanation: why,
});

const LIBRARY =
  "The Marlbeck library service surveyed 2,000 residents last spring. 62% of respondents said they had borrowed a book in the previous year, 41% said they had used the free computers, and only 9% said they had attended a library event. The service is considering closing its two smallest branches, which together account for about 3% of all loans.";
const BAKERY =
  "Copperleaf Bakeries opened twelve new shops during 2023. In the same year its average daily sales per shop fell by 6%, although total sales for the company rose by 18%.";
const CYCLE =
  "A city council counted cyclists on one commuter route on the first Tuesday of each month. In January the count was 410; by June it had risen to 890, and in December it was 380. The council notes that a new cycle lane opened in March.";
const HELPLINE =
  "A charity's helpline is staffed from 8 am to 8 pm. Last year it received 36,000 calls; 70% of them arrived between 4 pm and 8 pm. The charity's average call lasted 14 minutes, and callers who waited more than five minutes were far more likely to hang up before speaking to anyone.";

export const criticalThinking = [
  // ---- inference ------------------------------------------------------------------------------------------------
  inference(LIBRARY, "More than half of the residents surveyed had borrowed a book in the previous year.", "True", "62% of respondents borrowed a book, and 62% is more than half.", "easy"),
  inference(LIBRARY, "Most of the residents who used the free computers had also borrowed a book.", "Insufficient data", "The passage gives the share who borrowed and the share who used computers, but nothing about how far those groups overlap. The two could be entirely separate."),
  inference(LIBRARY, "More residents attended a library event than used the free computers.", "False", "Only 9% attended an event, against 41% who used the free computers, so the statement is the wrong way round.", "easy"),
  inference(BAKERY, "Total company sales in 2023 were higher than in 2022.", "True", "The passage says total sales rose by 18% in the same year.", "easy"),
  inference(BAKERY, "The new shops sold less per shop per day than the older shops did.", "Probably true", "Average sales per shop fell in a year when twelve new shops joined, which is most easily explained by the new shops selling less. It is not certain: the older shops' own sales might have fallen instead."),
  inference(BAKERY, "Each of the twelve new shops sold more per day than the average older shop did.", "Probably false", "If every new shop had out-sold the older ones, the company-wide average per shop would be expected to rise, not fall. It is not impossible, so this is probably false rather than false."),
  inference(CYCLE, "Cyclist numbers on this route rose in every month between January and June.", "Insufficient data", "The passage gives only the January and June counts. The counts in between could have gone up and down along the way."),
  inference(HELPLINE, "Fewer than half of the calls arrived before 4 pm.", "True", "70% arrived between 4 pm and 8 pm, so at most 30% arrived earlier, which is fewer than half.", "medium"),

  // ---- recognising assumptions ---------------------------------------------------------------------------------
  assumption("We should move the weekly team meeting to the morning — people are too tired to concentrate at four in the afternoon.", "People concentrate better in the morning than at four in the afternoon.", true, "Moving the meeting only makes sense as a fix for tiredness if mornings are better for concentration. The statement takes this for granted.", "easy"),
  assumption("We should move the weekly team meeting to the morning — people are too tired to concentrate at four in the afternoon.", "Every member of the team is available in the morning.", false, "The statement gives a reason for moving the meeting but does not rely on everyone's availability; it does not say or presuppose anything about that.", "medium"),
  assumption("The council should publish its spending online; residents are entitled to see how their money is used.", "Residents' money is the only source of the council's income.", false, "The statement says residents are entitled to see how their money is used. It does not claim, or rely on, their money being the council's only income.", "hard"),
  assumption("Because the shop's window display has changed, sales will rise next month.", "The window display influences how much customers buy.", true, "Linking a display change to a rise in sales only works if displays affect purchasing. The statement depends on that link.", "medium"),
  assumption("Our new laptop is lighter than the old one, so it will be better for people who travel.", "Travellers value a lighter laptop.", true, "The argument treats lightness as a benefit for travellers; without that assumption the conclusion would not follow.", "easy"),
  assumption("Our new laptop is lighter than the old one, so it will be better for people who travel.", "The new laptop has a longer battery life than the old one.", false, "The statement is about weight only. Battery life is neither stated nor needed for the reasoning.", "medium"),
  assumption("I'll take the 7:15 train instead of the 7:45; the earlier one is always less crowded.", "A less crowded train is preferable to a more crowded one.", true, "Choosing the earlier train because it is less crowded presupposes that a less crowded train is better.", "medium"),
  assumption("The gallery has reduced its ticket price to £6 in the hope of attracting more visitors.", "A lower price will attract more visitors.", true, "The price cut is described as aiming to increase visitors, which assumes price affects attendance.", "hard"),

  // ---- deduction --------------------------------------------------------------------------------------------------
  deduction("All the analysts in the office are on the graduate scheme.\nNo one on the graduate scheme works part-time.", "No analyst in the office works part-time.", true, "Analysts are all on the scheme, and nobody on the scheme is part-time, so no analyst can be part-time.", "easy"),
  deduction("Some of the volunteers are teachers.\nAll teachers have been background-checked.", "Some volunteers have been background-checked.", true, "At least one volunteer is a teacher, and every teacher is checked, so at least one volunteer is checked.", "medium"),
  deduction("All of the delivery vans are white.\nSome white vehicles are electric.", "Some of the delivery vans are electric.", false, "The electric white vehicles might all be something other than delivery vans. The statements leave that open.", "medium"),
  deduction("No one who arrived after nine was given a badge.\nMeera was given a badge.", "Meera did not arrive after nine.", true, "If she had arrived after nine she would not have received a badge. She did, so she cannot have arrived after nine.", "medium"),
  deduction("If the server fails, the backup switches on.\nThe backup did not switch on.", "The server did not fail.", true, "The backup would have switched on if the server had failed; it did not, so the server did not fail.", "hard"),
  deduction("If the server fails, the backup switches on.\nThe backup switched on.", "The server failed.", false, "The backup might switch on for other reasons (a test, a power dip). Knowing the backup started does not tell you the server failed.", "hard"),
  deduction("Every course in the catalogue is either evening or weekend.\nNo weekend course costs more than £300.\nThe Pottery course costs £450.", "The Pottery course is an evening course.", true, "It costs more than £300, so it is not a weekend course; every course is evening or weekend, so it must be an evening course.", "hard"),
  deduction("Some of the reports are late.\nAll late reports are sent to the director.", "All the reports are sent to the director.", false, "Only the late reports are sent to the director. The on-time reports may or may not be.", "medium"),

  // ---- interpretation ---------------------------------------------------------------------------------------------
  interpretation("A survey of 500 employees at a logistics firm found that 320 travel to work by car, 110 by bus and the rest on foot or by bicycle. Of those who drive, 40% said they would switch to a bus if the service ran every ten minutes.", "More than half of the employees surveyed travel to work by car.", true, "320 out of 500 is 64%, which is more than half.", "easy"),
  interpretation("A survey of 500 employees at a logistics firm found that 320 travel to work by car, 110 by bus and the rest on foot or by bicycle. Of those who drive, 40% said they would switch to a bus if the service ran every ten minutes.", "Fewer than 100 of the employees surveyed walk or cycle to work.", true, "500 − 320 − 110 = 70 walk or cycle, which is fewer than 100.", "medium"),
  interpretation("A survey of 500 employees at a logistics firm found that 320 travel to work by car, 110 by bus and the rest on foot or by bicycle. Of those who drive, 40% said they would switch to a bus if the service ran every ten minutes.", "If buses ran every ten minutes, 40% of the drivers would switch to the bus.", false, "40% of drivers said they would switch. What people say they would do is not what they will certainly do, so the conclusion goes beyond what the passage establishes.", "hard"),
  interpretation("Rainfall at a reservoir last year was 20% below the ten-year average. The water company reports that reservoir levels ended the year 5% below their usual level, and that it needed to buy in water on 12 days, compared with 3 days in a typical year.", "The reservoir needed more bought-in water last year than in a typical year.", true, "It bought in water on 12 days against 3 in a typical year, so it needed more.", "easy"),
  interpretation("Rainfall at a reservoir last year was 20% below the ten-year average. The water company reports that reservoir levels ended the year 5% below their usual level, and that it needed to buy in water on 12 days, compared with 3 days in a typical year.", "Low rainfall was the only reason the company had to buy in water.", false, "The passage links the two but does not say low rainfall was the only cause; demand, leaks or maintenance could also have played a part.", "medium"),
  interpretation("A training company reports that of the 240 people who started its accountancy course in 2022, 180 finished it and 150 of those passed the final exam at the first attempt.", "Exactly 60 of the people who started the course did not finish it.", true, "240 − 180 = 60 did not finish.", "easy"),
  interpretation("A training company reports that of the 240 people who started its accountancy course in 2022, 180 finished it and 150 of those passed the final exam at the first attempt.", "Most people who started the course passed the final exam at the first attempt.", true, "150 out of 240 is 62.5%, which is a majority of those who started.", "medium"),
  interpretation("A training company reports that of the 240 people who started its accountancy course in 2022, 180 finished it and 150 of those passed the final exam at the first attempt.", "The 30 people who finished the course but did not pass at the first attempt all failed the exam.", false, "They did not pass at the first attempt, but the passage does not say whether they failed, missed the exam, or were still waiting to be assessed.", "hard"),

  // ---- evaluating arguments -----------------------------------------------------------------------------------------
  argument("Should the company introduce a four-day working week?", "Yes — trials at similar companies have shown that output stayed the same while staff sickness absence fell.", true, "It is directly about the effect of a four-day week on the things a company cares about (output and absence), and it is a significant benefit.", "easy"),
  argument("Should the company introduce a four-day working week?", "No — some people enjoy Mondays.", false, "It is trivial and not directly about the working of the company; personal preference for a day of the week is not a serious reason.", "easy"),
  argument("Should all new employees be required to complete a fire-safety course in their first week?", "Yes — a person who does not know the evacuation routes puts themselves and others at risk in an emergency.", true, "It is directly related to the purpose of the course and concerns a serious consequence: safety in an emergency.", "medium"),
  argument("Should all new employees be required to complete a fire-safety course in their first week?", "No — the course would take up time that new starters could use to meet their colleagues.", false, "It is a minor inconvenience set against a safety issue, and the course does not stop them meeting colleagues at other times.", "medium"),
  argument("Should the local council close the swimming pool to save money?", "No — it is the only pool in the area, and many schools depend on it to teach children to swim.", true, "It concerns a substantial and direct consequence (children losing access to swimming lessons) for a large group.", "medium"),
  argument("Should the local council close the swimming pool to save money?", "Yes — the council has lots of other buildings that do not lose money.", false, "The profitability of other buildings has no bearing on whether this pool should close; it is not a direct reason.", "hard"),
  argument("Should the university ban laptops in lectures?", "Yes — studies of the university's own students show that those who take handwritten notes score higher on average in end-of-year exams.", true, "It is direct evidence about learning outcomes at this university, which is the main purpose of a lecture.", "hard"),
  argument("Should the university ban laptops in lectures?", "No — laptops are expensive and many students would be annoyed at leaving them at home.", false, "Cost and annoyance are not directly about whether a ban would improve lectures; the reason offered does not address the educational purpose.", "medium"),
];

export const criticalThinkingPacks = [
  { typeSlug: "critical-thinking", slug: "recognising-assumptions", name: "Critical Thinking: Recognising Assumptions", description: "Decide whether a statement takes something for granted — something it relies on but never says.", sectorStyle: "Consulting", secondsPerQuestion: 60 },
  { typeSlug: "critical-thinking", slug: "making-deductions", name: "Critical Thinking: Making Deductions", description: "Decide whether a conclusion follows necessarily from the statements given, treating them as true.", sectorStyle: "Law", secondsPerQuestion: 60 },
  { typeSlug: "critical-thinking", slug: "interpreting-information", name: "Critical Thinking: Interpreting Information", description: "Weigh whether a conclusion follows beyond reasonable doubt from a short data passage.", sectorStyle: "Accounting & Audit", secondsPerQuestion: 75 },
  { typeSlug: "critical-thinking", slug: "evaluating-arguments", name: "Critical Thinking: Evaluating Arguments", description: "Judge whether an argument is strong (important and directly related) or weak.", sectorStyle: "Public Sector", secondsPerQuestion: 45 },
];
