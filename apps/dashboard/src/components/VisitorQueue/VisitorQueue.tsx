import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/api-client";
import { VisitorPassPreview } from "../VisitorPass/VisitorPassPreview";
import "./VisitorQueue.css";

type QueueVisit = {
  id: string; fullName: string; phone?: string; organization: { name: string };
  departmentOrOffice?: string; hostName?: string; purpose: string;
  registeredAt: string; source: string; status: string;
  checkedInAt?: string; checkedOutAt?: string; pass?: { passNumber: string };
};

export function VisitorQueue() {
  const queryClient = useQueryClient();
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
      const printWindow = window.open("", "_blank", "width=420,height=720");
      if (!printWindow) return;

      printWindow.document.write(`<!doctype html><html><head><title>${pass.passNumber}</title><style>
        body{font-family:Arial,sans-serif;margin:0;padding:24px;text-align:center}
        .ticket{max-width:340px;margin:0 auto}
        img{width:260px;height:260px}
        @media print{@page{size:80mm auto;margin:4mm}body{padding:0}.ticket{max-width:72mm}}
      </style></head><body><div class="ticket">
        <h2>SMARTPASS360</h2>
        <strong>VISITOR ACCESS PASS</strong>
        <h3>${pass.fullName}</h3>
        <p>${pass.organizationName}</p>
        <p>Pass: <strong>${pass.passNumber}</strong></p>
        <img src="${pass.qrValue}" alt="Visitor QR" />
        <p>Issued: ${new Date(pass.issuedAt).toLocaleString()}</p>
        <p>Valid until: ${new Date(pass.validUntil).toLocaleString()}</p>
      </div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
      printWindow.document.close();
    }
  });
  return <section className="visitor-queue" aria-label="Reception and Security visitor queue">
    <header><div><h2>Reception / Security queue</h2><p>Building visits · updates every 3 seconds · latest 100 registrations</p></div><button type="button" onClick={() => void queue.refetch()}>Refresh queue</button></header>
    {(queue.error || approval.error) && <p role="alert">{(queue.error || approval.error)?.message}</p>}
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
