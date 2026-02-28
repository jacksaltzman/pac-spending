import { getMembers } from "@/lib/data";
import MembersTable from "./MembersTable";

export default function MembersPage() {
  const members = getMembers();
  return <MembersTable members={members} />;
}
