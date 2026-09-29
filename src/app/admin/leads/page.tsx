import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listNewsletterSubscribers, listContactMessages, listDemoRequests, listPartnerInquiries, listCampusCrewApplications } from "@/lib/admin/leads/queries";
import {
  deleteNewsletterSubscriber,
  deleteContactMessage,
  deleteDemoRequest,
  deletePartnerInquiry,
  deleteCampusCrewApplication,
} from "@/lib/admin/leads/actions";
import { DeleteLeadButton } from "@/components/admin/leads/delete-lead-button";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminLeadsPage() {
  const [subscribers, messages, demoRequests, partnerInquiries, campusCrew] = await Promise.all([
    listNewsletterSubscribers(),
    listContactMessages(),
    listDemoRequests(),
    listPartnerInquiries(),
    listCampusCrewApplications(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="newsletter">
        <TabsList>
          <TabsTrigger value="newsletter">Newsletter ({subscribers.length})</TabsTrigger>
          <TabsTrigger value="contact">Contact ({messages.length})</TabsTrigger>
          <TabsTrigger value="demo">Demo requests ({demoRequests.length})</TabsTrigger>
          <TabsTrigger value="partners">Partners ({partnerInquiries.length})</TabsTrigger>
          <TabsTrigger value="campus-crew">Campus Crew ({campusCrew.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="newsletter" className="pt-4">
          {subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscribers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Consented</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell className="text-sm">{subscriber.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{subscriber.consentSource}</TableCell>
                    <TableCell>
                      <Badge variant={subscriber.status === "subscribed" ? "tinted" : "outline"}>{subscriber.status === "pending" ? "pending confirmation" : subscriber.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(subscriber.subscribedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <DeleteLeadButton id={subscriber.id} action={deleteNewsletterSubscriber} label="subscriber" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="contact" className="flex flex-col gap-3 pt-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((message) => (
              <Card key={message.id} variant="admin" className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{message.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {message.name} · {message.email} · {formatDate(message.createdAt)}
                    </p>
                  </div>
                  <DeleteLeadButton id={message.id} action={deleteContactMessage} label="message" />
                </div>
                <p className="text-sm">{message.message}</p>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="demo" className="flex flex-col gap-3 pt-4">
          {demoRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No demo requests yet.</p>
          ) : (
            demoRequests.map((request) => (
              <Card key={request.id} variant="admin" className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{request.institutionName}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.contactName} · {request.email} {request.role ? `· ${request.role}` : ""} · {formatDate(request.createdAt)}
                    </p>
                  </div>
                  <DeleteLeadButton id={request.id} action={deleteDemoRequest} label="demo request" />
                </div>
                {request.studentPopulation && <p className="text-xs text-muted-foreground">Student population: {request.studentPopulation}</p>}
                {request.message && <p className="text-sm">{request.message}</p>}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="partners" className="flex flex-col gap-3 pt-4">
          {partnerInquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No partner inquiries yet.</p>
          ) : (
            partnerInquiries.map((inquiry) => (
              <Card key={inquiry.id} variant="admin" className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {inquiry.organisationName} · {inquiry.partnershipType}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inquiry.contactName} · {inquiry.email} · {formatDate(inquiry.createdAt)}
                    </p>
                  </div>
                  <DeleteLeadButton id={inquiry.id} action={deletePartnerInquiry} label="partner inquiry" />
                </div>
                <p className="text-sm">{inquiry.message}</p>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="campus-crew" className="flex flex-col gap-3 pt-4">
          {campusCrew.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Campus Crew applications yet.</p>
          ) : (
            campusCrew.map((application) => (
              <Card key={application.id} variant="admin" className="gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {application.name} · {application.university}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {application.email}
                      {application.course ? ` · ${application.course}` : ""}
                      {application.studyYear ? ` · ${application.studyYear}` : ""} · {formatDate(application.createdAt)}
                    </p>
                  </div>
                  <DeleteLeadButton id={application.id} action={deleteCampusCrewApplication} label="Campus Crew application" />
                </div>
                <p className="text-sm">{application.motivation}</p>
                {application.reach && <p className="text-xs text-muted-foreground">Could reach: {application.reach}</p>}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
