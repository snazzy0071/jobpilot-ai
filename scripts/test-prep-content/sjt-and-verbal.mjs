// Situational-judgement and verbal-reasoning practice. Every scenario, passage and statement is original to this file
// (invented people, organisations and figures). Not adapted from any published assessment or employer test.
//
// SJT: pick the MOST effective response. The best response is the constructive, honest and proportionate one; the
// distractors are the familiar wrong turns (avoiding it, escalating too early, covering up, blaming, doing nothing).
// Verbal reasoning: True / False / Cannot say, judged only from the passage.

const sjt = (pack, subtype, difficulty, scenario, best, others, why) => ({
  pack,
  subtype,
  difficulty,
  stimulus: scenario,
  prompt: "Which response is the most effective?",
  bestFirst: true, // the bank builder shuffles the options with a seeded generator
  options: [best, ...others],
  correct: best,
  explanation: why,
});

export const situationalJudgement = [
  // ---- graduate-programme-scenarios (joins the three already in that pack) --------------------------------------------
  sjt("graduate-programme-scenarios", "Teamwork", "easy",
    "You share a project with two colleagues. In the team chat one of them has not replied to any messages for three days, and a shared document you all need is still missing their section.",
    "Message them directly and ask whether they are stuck or short of time, offering to talk it through.",
    ["Finish their section yourself without telling anyone, so that the team meets the deadline and nobody is embarrassed.", "Tell your manager in the team chat that they are not pulling their weight, so that it is on record early.", "Wait until the deadline and see whether their part arrives, since chasing colleagues can feel like nagging."],
    "A direct, friendly check finds out what is actually wrong and keeps the working relationship intact. Quietly doing their work hides the problem; reporting them in public escalates before you have spoken to them; waiting risks the deadline."),
  sjt("graduate-programme-scenarios", "Prioritisation", "medium",
    "It is Thursday afternoon. Your manager has asked for a summary of last month's figures by Friday noon. This morning a senior colleague from another team asked you for help with a small data check that would take about two hours, 'whenever you can'.",
    "Tell the colleague when you can help (after Friday noon), and start your summary now.",
    ["Do the two-hour check first because they are senior, and finish the summary in the evening if you must.", "Say you are far too busy at the moment, without offering a time or any other way forward.", "Ask your manager to explain to the colleague that you have a deadline and cannot take on anything else."],
    "Being clear about when you can help, and protecting a committed deadline, is honest and useful to both. Putting the request first risks the deadline; a bare refusal is unhelpful; passing the message through your manager is unnecessary."),
  sjt("graduate-programme-scenarios", "Communication", "medium",
    "You have just presented your analysis to a client. Afterwards you realise you quoted one figure as 14% when the correct figure is 11%. The client has not noticed and the meeting is over.",
    "Email the client promptly with the corrected figure and its effect, and tell your manager what happened.",
    ["Leave it: the client did not notice and the overall conclusions are broadly the same either way.", "Mention the correction at the next scheduled meeting, when it can be covered along with other business.", "Quietly put the correct figure into the final report, without drawing attention to the earlier version."],
    "Correcting a known error quickly and openly protects the client's decisions and your credibility. Saying nothing or slipping in a quiet change leaves the client relying on a wrong number in the meantime."),
  sjt("graduate-programme-scenarios", "Initiative", "easy",
    "You finish your assigned tasks for the week on Wednesday. Your team has a backlog of small, unassigned tasks, and your manager is out of the office until Friday.",
    "Take on a small unassigned task within your ability and tell your manager what you did.",
    ["Use the quiet time to relax and wait, since your manager will assign more work when they are back.", "Start a large piece of work that you think would be valuable, without checking that it is wanted.", "Go round the team asking whether anyone needs anything, and leave it there if nobody does."],
    "Using spare time on something useful and within your remit, then reporting it, shows initiative without overstepping. Starting something large unasked, or waiting, are the two extremes."),
  sjt("graduate-programme-scenarios", "Resilience", "medium",
    "In your first performance review your manager says your written reports are 'too long and hard to follow'. You spent a lot of time on the last one and feel discouraged.",
    "Ask for specific examples of what worked less well and try those changes on your next report.",
    ["Explain that the reports were long because the subjects were complicated, and leave it at that for now.", "Say nothing in the meeting, and privately conclude that the feedback is unfair and not worth acting on.", "Ask to be moved off report-writing so that you can concentrate on the tasks you are better at."],
    "Turning general criticism into specific, testable changes is the most useful way to improve and shows you can take feedback. Defending, sulking or avoiding the work does not."),
  sjt("graduate-programme-scenarios", "Integrity", "hard",
    "A supplier offers you a personal discount on a laptop as 'a thank-you' for choosing their company for a team purchase. Your organisation's policy on gifts is not one you have read.",
    "Decline for now, read the policy, and check with your manager or compliance before deciding.",
    ["Accept it, since the team purchase has already been agreed and the discount does not change the price paid.", "Accept it and keep quiet about it, because it is only a small saving that nobody else would care about.", "Accept it but suggest the supplier offers the same discount to your colleagues to make it fair."],
    "You cannot know the discount is permitted until you have checked, and it could look like an inducement linked to a business decision. Declining until you know is the safe, transparent choice."),
  sjt("graduate-programme-scenarios", "Teamwork", "medium",
    "In a group meeting a colleague presents an idea you think has a serious flaw. Your manager seems pleased with it.",
    "Say what works, then raise the specific concern politely and suggest how to test or fix it.",
    ["Say nothing during the meeting to avoid awkwardness, and raise the concern with your manager afterwards.", "Tell the group plainly that the idea will not work, then explain in detail exactly where it fails.", "Wait to see whether anyone else spots the problem, since it may not be yours to point out."],
    "Raising a real concern constructively, in the meeting where it can be fixed, helps the team. Silence lets the flaw through; blunt dismissal harms the relationship without offering a way forward."),
  sjt("graduate-programme-scenarios", "Prioritisation", "hard",
    "You have three tasks due today: a routine report your manager will look at next week, a request from a client who needs an answer by 3 pm, and an internal survey response that closes at 5 pm. It is 1 pm and each task would take about an hour.",
    "Do the client's answer, then the survey, and defer the routine report to tomorrow, telling your manager.",
    ["Start with the routine report, because it is the largest piece of work and will take the most time.", "Do the survey first because it is the quickest, then work on the client's answer with what time is left.", "Ask your manager which to do first and wait for their reply before starting any of them."],
    "The client's 3 pm deadline is the most urgent and most consequential, and the survey has the next-nearest hard deadline. The report can move without harm if you say so. Waiting for instructions wastes the time you have."),

  // ---- customer-and-stakeholder-scenarios ---------------------------------------------------------------------------
  sjt("customer-and-stakeholder-scenarios", "Customer focus", "easy",
    "A customer phones to complain that their delivery has arrived damaged. You are not responsible for deliveries, and the delivery team has already left for the day.",
    "Apologise, take the details, say what happens next, and hand the case to the delivery team with everything they need.",
    ["Ask the customer to phone back tomorrow when the delivery team are in the office and can help.", "Explain that deliveries are not your department, and give them the general company number to try.", "Promise a replacement straight away, even though you are not authorised to promise one, to calm them down."],
    "The customer should not have to repeat themselves or wait for the right person. Owning the hand-over and telling them what happens next is helpful without promising something you cannot deliver."),
  sjt("customer-and-stakeholder-scenarios", "Communication", "medium",
    "A client emails you at 6 pm asking for a report by 9 am tomorrow. You know it cannot be done to a good standard by then.",
    "Reply now with what you can deliver by 9 am, or when the full report will be ready, and ask if that works.",
    ["Agree to the deadline and work late to produce what you can, without mentioning that it may be incomplete.", "Leave the email until the morning, when you can explain properly what was and was not possible overnight.", "Reply that the request is unreasonable and that you cannot help with a deadline this short."],
    "A prompt, honest reply with a realistic offer lets the client plan. Promising more than you can do, going silent, or refusing outright all leave them worse informed."),
  sjt("customer-and-stakeholder-scenarios", "Stakeholder management", "hard",
    "You are leading a small project. Two stakeholders give you conflicting requirements for the same deliverable, and each says their view is the priority.",
    "Set the two requirements side by side, explain the trade-offs to both, and ask them to agree priorities.",
    ["Follow whichever the more senior stakeholder asked for, as that is the safest way to avoid criticism.", "Build something that partly satisfies each of them so that neither feels that their request was ignored.", "Choose the requirement that is easier to deliver and get on with it without troubling either of them."],
    "Conflicting requirements need a decision by the people with authority to make it. Making the conflict visible and getting agreement avoids rework and resentment; guessing, splitting the difference or hiding the choice does not."),
  sjt("customer-and-stakeholder-scenarios", "Customer focus", "medium",
    "A regular customer is angry because the product they ordered has been out of stock for a week. They say they will take their business elsewhere.",
    "Listen, acknowledge the frustration, give an honest date (or promise to find one), and offer what you can.",
    ["Explain that the delay is the supplier's fault, not the company's, so the customer understands it is not being ignored.", "Offer a large discount at once, without checking whether you are allowed to, to keep them as a customer.", "Say you will pass the complaint on to the right team, and finish the call as soon as you politely can."],
    "People want to be heard and to know what will happen. Being honest about the date and offering what is within your authority is the best you can do; blaming the supplier or over-promising are not."),
  sjt("customer-and-stakeholder-scenarios", "Communication", "easy",
    "You realise mid-conversation that a customer has misunderstood the terms of a warranty and thinks it covers accidental damage, which it does not.",
    "Politely correct it now and explain what is and is not covered.",
    ["Let it go, because correcting them might lead to an argument that you would rather avoid.", "Wait until they actually make a claim and explain the position then, when it becomes relevant.", "Tell them warranties can be complicated and that they should read the full terms themselves."],
    "Being straightforward before they rely on a wrong belief saves them cost and disappointment. Telling them later, or being vague, leaves the problem in place."),
  sjt("customer-and-stakeholder-scenarios", "Stakeholder management", "medium",
    "Your project is running a week behind schedule because of a delay outside your control. The sponsor is expecting a status update on Monday.",
    "Tell the sponsor before Monday, with the cause and a revised plan with options.",
    ["Say nothing in the hope of catching up over the weekend, so that there is nothing to report on Monday.", "Report the delay on Monday as though it had only just come to light, to keep the meeting positive.", "Tell the sponsor the project is on track but 'flexible', so that they are reassured without alarm."],
    "Bad news early, with a plan, lets the sponsor help and keeps their trust. Hiding it or dressing it up damages trust much more than the delay does."),
  sjt("customer-and-stakeholder-scenarios", "Customer focus", "hard",
    "A customer asks for a refund on an item outside the 30-day refund period. It is a fair request in the circumstances (they were ill), but the policy is clear, and you are permitted to escalate exceptions to your team leader.",
    "Explain the policy, say the case seems reasonable, and escalate it to your team leader while keeping the customer informed.",
    ["Refuse the refund, because the policy is clear that it applies only within 30 days of purchase.", "Give the refund yourself, bending the policy, since it is obviously the fair thing to do in the circumstances.", "Tell the customer that the refund has been approved so that they stop asking, and hope it is approved."],
    "Using the exception route respects the policy and the customer. Rigid refusal ignores a fair case; unilateral bending of rules or telling them something untrue undermines both."),
  sjt("customer-and-stakeholder-scenarios", "Teamwork", "medium",
    "You have been asked to hand over a project to a colleague who is taking it on. You are moving to another team and are busy with the new role.",
    "Write a clear hand-over note, talk it through with your colleague, and stay reachable for questions for a set time.",
    ["Send the project folder with a message saying that you are busy in the new role but will help if you can.", "Tell them to ask the client directly about anything that is unclear, since the client knows the project.", "Hand it over in a conversation, and leave it to your colleague to write down whatever they need."],
    "A good hand-over is a professional responsibility; a folder and a message leave the new owner guessing, and asking the client exposes the gaps."),

  // ---- integrity-and-pressure-scenarios -----------------------------------------------------------------------------
  sjt("integrity-and-pressure-scenarios", "Integrity", "medium",
    "Your manager asks you to backdate a signature on a form so that it appears to have been completed before a deadline that was missed by two days.",
    "Decline to backdate it, offer to record the real date, and help to explain the delay.",
    ["Backdate it as asked, because your manager is responsible for the form and will have thought it through.", "Backdate it, but keep a private note of what actually happened in case anyone asks in the future.", "Refuse, then report your manager to HR straight away without first discussing your concern with them."],
    "Falsifying a record is dishonest whoever asks. Declining, explaining and offering an honest alternative is proportionate; reporting straight away without talking first is a step too far unless the pressure continues."),
  sjt("integrity-and-pressure-scenarios", "Integrity", "hard",
    "You discover that a colleague has been claiming expenses for taxi journeys that appear to be personal. You have no direct proof, only a pattern you have noticed.",
    "Take the facts you have to your manager or the confidential reporting route and leave the checking to them.",
    ["Confront your colleague directly and insist that they repay whatever they should not have claimed.", "Ignore it: without proof it is not your responsibility, and getting involved could cause trouble.", "Mention your suspicions to other colleagues to find out whether any of them has noticed the same thing."],
    "Reporting factual concerns through the right route protects the organisation and the colleague's right to a fair process. Confronting, ignoring or gossiping does not."),
  sjt("integrity-and-pressure-scenarios", "Resilience", "medium",
    "You have made a mistake that has delayed an important release by a day. Your team is under pressure and some are irritated.",
    "Tell the team what happened, apologise briefly, fix it fast, and then work out how to prevent it.",
    ["Point out that the instructions you were given were unclear and so the delay is partly not your fault.", "Work through the night to catch up without telling anyone, so that nobody has to know what went wrong.", "Say nothing and hope that nobody traces the delay back to you before the release is finally out."],
    "Owning a mistake calmly and moving quickly to a fix keeps trust. Blaming, hiding and silent heroics leave the team in the dark."),
  sjt("integrity-and-pressure-scenarios", "Prioritisation", "hard",
    "Late on Friday you are asked by two different managers to do urgent work over the weekend. Each says theirs is the most important. You can only do one.",
    "Tell both managers about the clash now and ask them, or your line manager, to decide the priority.",
    ["Do whichever request arrived first and tell the other manager politely that you are not available.", "Agree to both and try to do each of them quickly, accepting that neither will be as good as it could be.", "Do neither, since you cannot satisfy both managers and it would not be fair to favour one of them."],
    "The conflict is for the managers to resolve with full information. Silently choosing or over-promising helps no one."),
  sjt("integrity-and-pressure-scenarios", "Integrity", "medium",
    "During a job assessment day another candidate leaves their notes on the table, and you notice they contain the answers to the exercise you are about to do.",
    "Leave them unread, tell an assessor what happened, and carry on with the exercise honestly.",
    ["Glance through them, since you have already seen what they are and cannot un-see it now.", "Tuck the notes safely away so that the other candidate does not lose them, and say nothing about them.", "Take a quick photo in case you need to show somebody afterwards what you saw on the table."],
    "Using the answers would be cheating; telling the assessors is the honest and proportionate step and protects you if anyone later asks."),
  sjt("integrity-and-pressure-scenarios", "Resilience", "easy",
    "You are rejected after the final round of an interview for a job you badly wanted, and you feel embarrassed.",
    "Ask politely for feedback, note what you can learn from it, and keep applying.",
    ["Decide that interviews are not your strength and that you should stop applying for jobs like this one.", "Reply to the rejection with an email setting out why you think the decision was wrong and unfair.", "Avoid telling anyone about the outcome, since it is embarrassing and will only remind you of it."],
    "Feedback turns a disappointment into something usable. Giving up or reacting angrily closes doors."),
  sjt("integrity-and-pressure-scenarios", "Communication", "hard",
    "A colleague has told you in confidence that they are looking for another job. Your manager asks you directly whether anyone on the team is thinking of leaving.",
    "Say you cannot speak for others, and suggest your manager talks with the team about their plans.",
    ["Tell your manager what your colleague said, because you were asked a direct question and should answer honestly.", "Say that nobody is thinking of leaving, even though you know that this is not the case, to protect them.", "Warn your colleague that your manager has been asking, and share what was said so that they are prepared."],
    "You can decline to share a confidence without lying. Telling a direct falsehood, or breaking the confidence, are both worse."),
  sjt("integrity-and-pressure-scenarios", "Initiative", "medium",
    "You notice that a process your team uses often causes small errors that need correcting later. No one has raised it.",
    "Collect a few examples, propose a specific improvement, and raise it with your manager or team.",
    ["Complain about the process to colleagues over lunch, since someone influential may then hear about it.", "Change the process yourself without telling anyone, since the improvement is clearly worth having.", "Assume that someone more experienced has already thought about it and that a change would be unwelcome."],
    "Evidence plus a concrete suggestion, raised through the proper route, is how an improvement actually gets adopted."),
];

export const situationalPacks = [
  { typeSlug: "situational-judgement", slug: "customer-and-stakeholder-scenarios", name: "Workplace Scenarios: Customers & Stakeholders", description: "Choose the most effective response in situations with customers, clients and colleagues who want different things.", sectorStyle: "Retail & Consumer", secondsPerQuestion: 60 },
  { typeSlug: "situational-judgement", slug: "integrity-and-pressure-scenarios", name: "Workplace Scenarios: Integrity & Pressure", description: "Judge the most effective response when honesty, confidentiality or pressure is at stake.", sectorStyle: "Public Sector", secondsPerQuestion: 60 },
];

// ---- verbal reasoning ---------------------------------------------------------------------------------------------------

const TFC = ["True", "False", "Cannot say"];
const verbal = (pack, subtype, difficulty, passage, statement, correct, why) => ({
  pack,
  subtype,
  difficulty,
  stimulus: passage,
  prompt: `Statement: "${statement}"\n\nBased only on the passage, is the statement true, false, or can you not say?`,
  options: TFC,
  correct,
  explanation: why,
});

const WORKSHARE =
  "Fenwick Council introduced a shared-desk policy in its main office two years ago. Under the policy, staff who work from home at least two days a week give up their fixed desk and book one when they come in. The council says the change allowed it to close one floor, saving £180,000 a year. A staff survey found that 58% of employees felt the new system was 'about the same or better' than fixed desks, while a fifth said they sometimes could not find a desk on the day they wanted one.";
const TIDES =
  "Tidal power stations generate electricity from the regular rise and fall of the sea. Unlike wind or solar power, their output can be predicted years ahead, because tides follow the movements of the moon and sun. However, building a barrage across an estuary is expensive, and can change the habitat of wading birds and fish. Only a handful of large tidal power stations operate worldwide, and most of the world's suitable estuaries have not yet been developed.";
const RETAILER =
  "Ostler & Reeve, a furniture retailer, reported that its online sales grew by 24% last year, while sales in its 30 stores fell by 3%. Overall, revenue rose. The company says it will close four of its stores when their leases expire next year, but that it will open two new 'showroom-only' sites in cities where its online sales are strongest. Customers at showrooms cannot take furniture away; orders are delivered from a central warehouse.";
const GRANTS =
  "A regional arts fund awards grants twice a year. Applicants must be based in the region and may apply for up to £15,000. In the last round, 210 applications were received and 42 were funded. The fund's report says the average grant awarded was £8,500, and that the largest number of successful applications came from theatre companies. The fund is reviewed every three years by an independent panel.";
const SLEEP =
  "Researchers followed 1,200 adults for five years to study the link between sleep and health. Those who regularly slept fewer than six hours a night were more likely to develop high blood pressure than those who slept seven to eight hours. The researchers stress that the study cannot show that short sleep causes high blood pressure, as people with early health problems may also sleep less. They recommend larger studies that track sleep with monitors rather than questionnaires.";
const BUS =
  "A rural bus company, Dalby Coaches, operates route 12 between two villages and the market town of Harrow. The service ran hourly until last spring, when it was cut to every two hours because of a shortage of drivers. Passenger numbers on the route fell by a third afterwards. The company has advertised for drivers and says it hopes to restore the hourly service by next autumn, although it has not confirmed a date.";

export const verbalReasoning = [
  // passage-analysis (joins the three already in that pack)
  verbal("passage-analysis", "True / False / Cannot say", "easy", WORKSHARE, "Staff who work from home two days a week lose their fixed desk under the policy.", "True", "The passage says staff who work from home at least two days a week give up their fixed desk."),
  verbal("passage-analysis", "True / False / Cannot say", "medium", WORKSHARE, "The policy saved the council more than £200,000 a year.", "False", "The saving stated is £180,000 a year, which is less than £200,000."),
  verbal("passage-analysis", "True / False / Cannot say", "medium", WORKSHARE, "Most staff who took part in the survey preferred the shared desks to fixed desks.", "Cannot say", "58% said the new system was 'about the same or better'. That mixes 'the same' with 'better', so it does not tell you how many actually preferred it."),
  verbal("passage-analysis", "True / False / Cannot say", "hard", WORKSHARE, "Some staff were unable to find a desk on the day they wanted one.", "True", "A fifth of staff said they sometimes could not find a desk when they wanted one, so some staff were sometimes unable to."),
  verbal("passage-analysis", "True / False / Cannot say", "easy", TIDES, "The output of a tidal power station can be forecast years in advance.", "True", "The passage says tidal output can be predicted years ahead because tides follow the moon and sun."),
  verbal("passage-analysis", "True / False / Cannot say", "medium", TIDES, "Tidal power stations are cheaper to build than wind farms.", "Cannot say", "The passage says building a tidal barrage is expensive, but never compares its cost with that of wind farms."),
  verbal("passage-analysis", "True / False / Cannot say", "medium", TIDES, "Most of the world's suitable estuaries already have tidal power stations.", "False", "The passage says most suitable estuaries have not yet been developed."),
  verbal("passage-analysis", "True / False / Cannot say", "hard", TIDES, "Tidal barrages can affect the animals that live in an estuary.", "True", "The passage says a barrage can change the habitat of wading birds and fish."),

  // business-briefings
  verbal("business-briefings", "True / False / Cannot say", "easy", RETAILER, "Ostler & Reeve's store sales fell last year.", "True", "Sales in its stores fell by 3%."),
  verbal("business-briefings", "True / False / Cannot say", "medium", RETAILER, "Ostler & Reeve will have more stores after next year's changes than it has now.", "False", "It will close four stores and open only two showroom-only sites, so even if showrooms are counted as stores there will be fewer, not more."),
  verbal("business-briefings", "True / False / Cannot say", "medium", RETAILER, "Customers can take furniture home from the new showroom sites.", "False", "The passage says customers at showrooms cannot take furniture away; orders are delivered from the warehouse."),
  verbal("business-briefings", "True / False / Cannot say", "hard", RETAILER, "Customers who visit a showroom are more likely to buy than customers who only browse online.", "Cannot say", "The passage says where the showrooms will be and how orders are delivered, but gives no information about how likely showroom visitors are to buy."),
  verbal("business-briefings", "True / False / Cannot say", "easy", GRANTS, "The arts fund awards grants twice a year.", "True", "The first sentence says grants are awarded twice a year."),
  verbal("business-briefings", "True / False / Cannot say", "medium", GRANTS, "More than a fifth of applications in the last round were funded.", "False", "42 out of 210 is exactly 20%, which is not more than a fifth."),
  verbal("business-briefings", "True / False / Cannot say", "medium", GRANTS, "An applicant based in another region may apply if their project is strong enough.", "False", "Applicants must be based in the region."),
  verbal("business-briefings", "True / False / Cannot say", "hard", GRANTS, "Theatre companies received more grants than any other type of applicant.", "True", "The report says the largest number of successful applications came from theatre companies, so no other type received more."),

  // science-and-society
  verbal("science-and-society", "True / False / Cannot say", "easy", SLEEP, "The study followed 1,200 adults.", "True", "The passage states the number of adults followed."),
  verbal("science-and-society", "True / False / Cannot say", "medium", SLEEP, "The study proved that sleeping fewer than six hours causes high blood pressure.", "False", "The researchers say explicitly that the study cannot show short sleep causes high blood pressure."),
  verbal("science-and-society", "True / False / Cannot say", "medium", SLEEP, "People who slept seven to eight hours never developed high blood pressure.", "Cannot say", "The passage says they were less likely to, not that none did."),
  verbal("science-and-society", "True / False / Cannot say", "hard", SLEEP, "The researchers recommend further studies on a larger scale.", "True", "They recommend larger studies that track sleep with monitors."),
  verbal("science-and-society", "True / False / Cannot say", "easy", BUS, "Route 12 used to run every hour.", "True", "The service ran hourly until last spring."),
  verbal("science-and-society", "True / False / Cannot say", "medium", BUS, "Passenger numbers on the route fell because the service became less frequent.", "Cannot say", "The passage reports that numbers fell by a third after the cut, but does not say the reduction in service was the cause."),
  verbal("science-and-society", "True / False / Cannot say", "medium", BUS, "The hourly service will definitely return by next autumn.", "False", "The company hopes to restore it by next autumn but has not confirmed a date, so it is not definite."),
  verbal("science-and-society", "True / False / Cannot say", "hard", BUS, "The service was reduced because there were not enough drivers.", "True", "The cut to every two hours was made because of a shortage of drivers."),
];

export const verbalPacks = [
  { typeSlug: "verbal-reasoning", slug: "business-briefings", name: "Verbal Reasoning: Business Briefings", description: "True, False or Cannot Say from short business and funding passages.", sectorStyle: "Retail & Consumer", secondsPerQuestion: 75 },
  { typeSlug: "verbal-reasoning", slug: "science-and-society", name: "Verbal Reasoning: Science & Society", description: "True, False or Cannot Say from short passages on research, transport and energy.", sectorStyle: "Public Sector", secondsPerQuestion: 75 },
];
