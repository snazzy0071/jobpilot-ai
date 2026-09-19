import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import { SECTION_KEYS } from "@/lib/cvs/types";

// A fully-invented person and employers (matching this project's
// established fictional-company convention — Marlow Tech, Northbridge
// Partners, and similar names already used elsewhere) — used only to
// give the template gallery's thumbnails real, representative content to
// render, never a real or historical person's identity. Deliberately
// about one page long, with categorised skills and bulleted achievements,
// so every thumbnail shows what a template does with headings, entries,
// bullets, skills, projects and credentials rather than a half-empty page.
export const CV_TEMPLATE_SAMPLE_DATA: CvTemplateContentData = {
  personal: {
    id: "sample-personal",
    fullName: "Jordan Blake",
    headline: "Senior Marketing Manager",
    email: "jordan.blake@example.com",
    phone: "07700 900123",
    location: "Manchester, UK",
    websiteUrl: null,
    linkedinUrl: "linkedin.com/in/jordanblake",
    portfolioUrl: null,
  },
  summary: {
    id: "sample-summary",
    content:
      "Marketing manager with 8 years' experience leading integrated campaigns for growing UK brands. Confident owning budgets, coaching small teams and turning customer insight into measurable revenue growth.",
  },
  experience: [
    {
      id: "sample-exp-1",
      jobTitle: "Senior Marketing Manager",
      employer: "Marlow Tech",
      location: "Manchester",
      startDate: "2022-03-01",
      endDate: null,
      isCurrent: true,
      description:
        "- Lead a team of five running paid, social and email campaigns with a £420k annual budget\n- Grew qualified inbound leads by 38% in 12 months through SEO and lifecycle email\n- Introduced a monthly reporting cadence that cut wasted ad spend by 17%",
      displayOrder: 0,
    },
    {
      id: "sample-exp-2",
      jobTitle: "Marketing Executive",
      employer: "Northbridge Partners",
      location: "Leeds",
      startDate: "2019-06-01",
      endDate: "2022-02-01",
      isCurrent: false,
      description:
        "- Planned and launched campaigns for three product lines across web, events and PR\n- Managed the content calendar and a network of eight freelance writers",
      displayOrder: 1,
    },
    {
      id: "sample-exp-3",
      jobTitle: "Digital Marketing Assistant",
      employer: "Halden & Co",
      location: "Sheffield",
      startDate: "2017-09-01",
      endDate: "2019-05-01",
      isCurrent: false,
      description: "- Supported social, email and website updates for a portfolio of 12 retail clients",
      displayOrder: 2,
    },
  ],
  education: [
    {
      id: "sample-edu-1",
      institution: "Northbridge University",
      qualification: "BA (Hons) Marketing",
      fieldOfStudy: "Marketing",
      location: "Leeds",
      startDate: "2014-09-01",
      endDate: "2017-06-30",
      isCurrent: false,
      grade: "First-class honours",
      description: null,
      displayOrder: 0,
    },
  ],
  skills: [
    { id: "sample-skill-1", name: "Campaign strategy", category: "Marketing", displayOrder: 0, isVisible: true },
    { id: "sample-skill-2", name: "SEO", category: "Marketing", displayOrder: 1, isVisible: true },
    { id: "sample-skill-3", name: "Paid social", category: "Marketing", displayOrder: 2, isVisible: true },
    { id: "sample-skill-4", name: "Email lifecycle", category: "Marketing", displayOrder: 3, isVisible: true },
    { id: "sample-skill-5", name: "Google Analytics", category: "Tools", displayOrder: 4, isVisible: true },
    { id: "sample-skill-6", name: "HubSpot", category: "Tools", displayOrder: 5, isVisible: true },
    { id: "sample-skill-7", name: "Looker Studio", category: "Tools", displayOrder: 6, isVisible: true },
    { id: "sample-skill-8", name: "Team leadership", category: "Leadership", displayOrder: 7, isVisible: true },
    { id: "sample-skill-9", name: "Budget management", category: "Leadership", displayOrder: 8, isVisible: true },
  ],
  projects: [
    {
      id: "sample-project-1",
      name: "Brand relaunch campaign",
      description: "Coordinated a full brand refresh across web, social and print, on time and 6% under budget.",
      url: null,
      technologies: ["Webflow", "Figma"],
      startDate: "2023-01-01",
      endDate: "2023-06-01",
      isOngoing: false,
      displayOrder: 0,
      isVisible: true,
    },
  ],
  certifications: [
    {
      id: "sample-cert-1",
      name: "Google Analytics Certified",
      issuingOrganization: "Google",
      issueDate: "2023-01-01",
      expiryDate: null,
      credentialId: null,
      credentialUrl: null,
      displayOrder: 0,
      isVisible: true,
    },
    {
      id: "sample-cert-2",
      name: "Professional Diploma in Digital Marketing",
      issuingOrganization: "Chartered Institute of Marketing",
      issueDate: "2020-05-01",
      expiryDate: null,
      credentialId: null,
      credentialUrl: null,
      displayOrder: 1,
      isVisible: true,
    },
  ],
  languages: [
    { id: "sample-lang-1", name: "English", proficiency: "native", displayOrder: 0, isVisible: true },
    { id: "sample-lang-2", name: "French", proficiency: "conversational", displayOrder: 1, isVisible: true },
  ],
  customSections: [],
  sectionOrder: [...SECTION_KEYS],
};
