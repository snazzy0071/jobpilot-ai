import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import { SECTION_KEYS } from "@/lib/cvs/types";

// A fully-invented person and employers (matching this project's
// established fictional-company convention — Marlow Tech, Northbridge
// Partners, and similar names already used elsewhere) — used only to
// give the template-picker gallery's thumbnails real, representative
// content to render, never a real or historical person's identity.
export const CV_TEMPLATE_SAMPLE_DATA: CvTemplateContentData = {
  personal: {
    id: "sample-personal",
    fullName: "Jordan Blake",
    headline: "Marketing Manager",
    email: "jordan.blake@example.com",
    phone: "07700 900123",
    location: "Manchester, UK",
    websiteUrl: null,
    linkedinUrl: "linkedin.com/in/jordanblake",
    portfolioUrl: null,
  },
  summary: {
    id: "sample-summary",
    content: "Marketing manager with 6 years' experience leading campaigns for growing UK brands.",
  },
  experience: [
    {
      id: "sample-exp-1",
      jobTitle: "Marketing Manager",
      employer: "Marlow Tech",
      location: "Manchester",
      startDate: "2022-03-01",
      endDate: null,
      isCurrent: true,
      description: "Leads a team of 4 running campaigns across paid, social and email channels.",
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
      description: "Managed content calendars and coordinated launch campaigns for 3 product lines.",
      displayOrder: 1,
    },
  ],
  education: [
    {
      id: "sample-edu-1",
      institution: "Northbridge University",
      qualification: "BA (Hons) Marketing",
      fieldOfStudy: "Marketing",
      location: "Leeds",
      startDate: "2015-09-01",
      endDate: "2018-06-30",
      isCurrent: false,
      grade: "2:1",
      description: null,
      displayOrder: 0,
    },
  ],
  skills: [
    { id: "sample-skill-1", name: "Campaign Strategy", category: null, displayOrder: 0, isVisible: true },
    { id: "sample-skill-2", name: "SEO", category: null, displayOrder: 1, isVisible: true },
    { id: "sample-skill-3", name: "Paid Social", category: null, displayOrder: 2, isVisible: true },
    { id: "sample-skill-4", name: "Team Leadership", category: null, displayOrder: 3, isVisible: true },
  ],
  projects: [
    {
      id: "sample-project-1",
      name: "Brand Relaunch Campaign",
      description: "Coordinated a full brand refresh across web, social and print.",
      url: null,
      technologies: [],
      startDate: null,
      endDate: null,
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
  ],
  languages: [{ id: "sample-lang-1", name: "French", proficiency: "conversational", displayOrder: 0, isVisible: true }],
  customSections: [],
  sectionOrder: [...SECTION_KEYS],
};
