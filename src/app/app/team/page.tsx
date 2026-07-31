import {
  assignMemberPropertyAction,
  removeMemberPropertyAssignmentAction,
  revokeInvitationAction,
  suspendMemberAction,
  updateMemberRoleAction,
} from "@/app/app/team/actions";
import { CircleAlert } from "lucide-react";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { PageHeader } from "@/components/app/page-header";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function tenantName(tenant: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}) {
  return (
    tenant.company_name ||
    [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") ||
    "Mieter"
  );
}

export default async function TeamPage() {
  const viewer = await requireOrganization();
  const canManage = hasPermission(viewer.role, "team.manage");

  if (!canManage) {
    return (
      <>
        <PageHeader
          eyebrow="Rollen & Zugriffe"
          title="Team"
          description="Einladungen, Rollen und Zugriffe deiner Organisation verwalten."
        />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>403 · Zugriff verweigert</AlertTitle>
          <AlertDescription>
            Deine aktuelle Rolle darf Teammitglieder, Einladungen und
            Objektzuweisungen nicht verwalten. Es wurden keine Teamdaten
            abgefragt.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const supabase = await createClient();
  const [
    { data: members },
    { data: invitations },
    { data: tenants },
    { data: properties },
    { data: propertyAssignments },
  ] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, status, created_at")
        .eq("organization_id", viewer.organizationId)
        .order("created_at"),
      supabase
        .from("invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("organization_id", viewer.organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("tenants")
        .select("id, first_name, last_name, company_name")
        .eq("organization_id", viewer.organizationId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("last_name"),
      supabase
        .from("properties")
        .select("id, name, city, status")
        .eq("organization_id", viewer.organizationId)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("property_assignments")
        .select("id, member_id, property_id")
        .eq("organization_id", viewer.organizationId)
        .order("created_at"),
    ]);

  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };
  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  const propertyMap = new Map(
    (properties ?? []).map((property) => [property.id, property]),
  );
  const assignmentsByMember = new Map<
    string,
    NonNullable<typeof propertyAssignments>
  >();
  for (const assignment of propertyAssignments ?? []) {
    const current = assignmentsByMember.get(assignment.member_id) ?? [];
    current.push(assignment);
    assignmentsByMember.set(assignment.member_id, current);
  }

  return (
    <>
      <PageHeader
        eyebrow="Rollen & Zugriffe"
        title="Team"
        description="Einladungen, Rollen und Zugriffe deiner Organisation verwalten."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Aktive Mitglieder ({members?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {(members ?? []).map((member) => {
                const profile = profileMap.get(member.user_id);
                const protectedMember =
                  member.role === "owner" || member.user_id === viewer.userId;
                const assignments =
                  assignmentsByMember.get(member.id) ?? [];
                const assignedPropertyIds = new Set(
                  assignments.map((assignment) => assignment.property_id),
                );
                const availableProperties = (properties ?? []).filter(
                  (property) => !assignedPropertyIds.has(property.id),
                );
                return (
                  <div
                    key={member.id}
                    className="p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {profile?.full_name || profile?.email || "Teammitglied"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {profile?.email || "Keine E-Mail sichtbar"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{member.status}</Badge>
                        {canManage &&
                        !protectedMember &&
                        member.role !== "tenant" ? (
                          <form
                            action={updateMemberRoleAction}
                            className="flex gap-2"
                          >
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                            >
                              <option value="admin">Administrator</option>
                              <option value="property_manager">
                                Immobilienmanager
                              </option>
                              <option value="accounting">Buchhaltung</option>
                              <option value="employee">Mitarbeiter</option>
                            </select>
                            <Button type="submit" size="sm" variant="outline">
                              Speichern
                            </Button>
                          </form>
                        ) : (
                          <Badge>{member.role}</Badge>
                        )}
                        {canManage && !protectedMember ? (
                          <form action={suspendMemberAction}>
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              Sperren
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>

                    {member.role === "employee" ? (
                      <div className="mt-4 rounded-xl border bg-muted/30 p-4">
                        <div>
                          <p className="text-sm font-medium">
                            Immobilienzugriff
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Mitarbeiter sehen ausschließlich explizit
                            zugewiesene Immobilien und die davon abhängigen
                            Bereiche.
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {assignments.map((assignment) => {
                            const property = propertyMap.get(
                              assignment.property_id,
                            );
                            if (!property) return null;
                            return (
                              <form
                                key={assignment.id}
                                action={removeMemberPropertyAssignmentAction}
                                className="flex items-center gap-1 rounded-full border bg-background py-1 pl-3 pr-1"
                              >
                                <input
                                  type="hidden"
                                  name="assignmentId"
                                  value={assignment.id}
                                />
                                <span className="text-xs">
                                  {property.name}
                                  {property.city ? ` · ${property.city}` : ""}
                                </span>
                                {canManage ? (
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 rounded-full px-2 text-xs"
                                    aria-label={`Zugriff auf ${property.name} entfernen`}
                                  >
                                    Entfernen
                                  </Button>
                                ) : null}
                              </form>
                            );
                          })}
                          {assignments.length === 0 ? (
                            <Badge variant="outline">
                              Noch keine Immobilie zugewiesen
                            </Badge>
                          ) : null}
                        </div>
                        {canManage &&
                        member.status === "active" &&
                        availableProperties.length > 0 ? (
                          <form
                            action={assignMemberPropertyAction}
                            className="mt-3 flex flex-col gap-2 sm:flex-row"
                          >
                            <input
                              type="hidden"
                              name="membershipId"
                              value={member.id}
                            />
                            <select
                              name="propertyId"
                              required
                              defaultValue=""
                              aria-label="Immobilie für Mitarbeiter auswählen"
                              className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
                            >
                              <option value="" disabled>
                                Immobilie auswählen
                              </option>
                              {availableProperties.map((property) => (
                                <option key={property.id} value={property.id}>
                                  {property.name}
                                  {property.city ? ` · ${property.city}` : ""}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" size="sm" variant="outline">
                              Zugriff zuweisen
                            </Button>
                          </form>
                        ) : null}
                        {canManage && (properties ?? []).length === 0 ? (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Lege zuerst eine Immobilie an, bevor du Zugriff
                            zuweist.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Offene Einladungen</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {(invitations ?? []).map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invitation.role} · gültig bis{" "}
                      {new Intl.DateTimeFormat("de-DE").format(
                        new Date(invitation.expires_at),
                      )}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={revokeInvitationAction}>
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.id}
                      />
                      <Button type="submit" variant="ghost" size="sm">
                        Widerrufen
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
              {(invitations ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Keine offenen Einladungen.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Person einladen</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <InviteMemberForm
                tenants={(tenants ?? []).map((tenant) => ({
                  id: tenant.id,
                  name: tenantName(tenant),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Deine Rolle darf Teamzugriffe einsehen, aber nicht verändern.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
