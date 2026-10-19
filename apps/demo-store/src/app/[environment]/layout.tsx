import { notFound } from "next/navigation";
import { StoreProvider } from "../../components/store-context";

export default async function EnvironmentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ environment: string }> }) {
  const { environment } = await params;
  if (!["staging", "uat", "preprod", "prod"].includes(environment)) notFound();
  return <StoreProvider key={environment} environment={environment}>{children}</StoreProvider>;
}
