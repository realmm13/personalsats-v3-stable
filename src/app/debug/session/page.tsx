import { getServerSession } from "@/server/auth";

export default async function DebugSessionPage() {
  const session = await getServerSession();

  return (
    <pre>
      {JSON.stringify(session, null, 2)}
    </pre>
  );
} 