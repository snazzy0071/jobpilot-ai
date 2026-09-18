export type AdminNewsletterSubscriber = {
  id: string;
  email: string;
  subscribedAt: string;
  consentSource: string;
  status: "subscribed" | "unsubscribed";
  unsubscribedAt: string | null;
};

export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
};

export type AdminDemoRequest = {
  id: string;
  institutionName: string;
  contactName: string;
  email: string;
  role: string | null;
  studentPopulation: string | null;
  message: string | null;
  createdAt: string;
};

export type AdminPartnerInquiry = {
  id: string;
  organisationName: string;
  contactName: string;
  email: string;
  partnershipType: string;
  message: string;
  createdAt: string;
};
