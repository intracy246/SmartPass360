import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/api-client";
import { printVisitorPass } from "../../utils/visitor-pass-print";
import "./VisitorQueue.css";

type QueueVisit = {
  id: string; fullName: string; phone?: string; organization: { name: string };
  departmentOrOffice?: string; hostName?: string; purpose: string;
  registeredAt: string; source: string; status: string;
  checkedInAt?: string; checkedOutAt?: string; pass?: { passNumber: string };
};

export function VisitorQueue() {
  const queryClient = useQueryClient();
  const [printError, setPrintError] = useState<string | null>(null);
  const queue = useQuery({ queryKey: ["visitor-queue"], queryFn: () => apiRequest<{ data: QueueVisit[] }>("/visitors"), refetchInterval: 3000 });
  const approval = useMutation({
    mutationFn: (visitId: string) => apiRequest<{ success: boolean; data: { pass: {
      passNumber: string;
      qrValue: string;
      fullName: string;
      organizationName: string;
      issuedAt: string;
      validUntil: string;
    } } }>(`/visitors/${visitId}/approve-and-issue`, { method: "POST" }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["visitor-queue"] });

      const pass = response.data.pass;
      try {
        setPrintError(null);
        await printVisitorPass(pass);
      } catch (error) {
        setPrintError(
          error instanceof Error
            ? error.message
            : "The issued visitor pass could not be printed."
        );
      }
    }
  });
  return <section className="visitor-queue" aria-label="Reception and Security visitor queue">
    <header><div><h2>Reception / Security queue</h2><p>Building visits · updates every 3 seconds · latest 100 registrations</p></div><button type="button" onClick={() => void queue.refetch()}>Refresh queue</button></header>
    {(queue.error || approval.error || printError) && (
      <p role="alert">
        {(queue.error || approval.error)?.message ?? printError}
      </p>
    )}
    {queue.isPending && <p>Loading visits…</p>}
    {queue.data?.data.length === 0 && <p>No visits registered for this building.</p>}
    <div className="visitor-queue__scroll"><table><thead><tr><th>Visitor / phone</th><th>Organization / destination</th><th>Purpose</th><th>Registered / source</th><th>Status / pass</th><th>Action</th></tr></thead><tbody>
      {queue.data?.data.map(visit => <tr key={visit.id}>
        <td><strong>{visit.fullName}</strong><br />{visit.phone || "—"}</td>
        <td>{visit.organization.name}<br />{visit.departmentOrOffice}<br />{visit.hostName}</td>
        <td>{visit.purpose || "—"}</td>
        <td>{new Date(visit.registeredAt).toLocaleString()}<br />{visit.source}</td>
        <td><strong>{visit.status.replaceAll("_", " ")}</strong><br />{visit.pass?.passNumber}
          {visit.checkedInAt && <div>Entry: {new Date(visit.checkedInAt).toLocaleString()}</div>}
          {visit.checkedOutAt && <div>Exit: {new Date(visit.checkedOutAt).toLocaleString()}</div>}
        </td>
        <td>{visit.status === "PENDING_APPROVAL" ? <button type="button" disabled={approval.isPending} onClick={() => approval.mutate(visit.id)}>Approve & print</button> : "—"}</td>
      </tr>)}
    </tbody></table></div>
  </section>;
}
