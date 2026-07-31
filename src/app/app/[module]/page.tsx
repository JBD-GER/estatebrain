import { notFound } from "next/navigation";
import { ModuleWorkspace } from "@/components/app/module-workspace";
import { getModulePageData } from "@/lib/data/modules";
import { allowedModuleSlugs } from "@/lib/modules";

export function generateStaticParams() {
  return allowedModuleSlugs.map((module) => ({ module }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const data = await getModulePageData(module);
  if (!data) notFound();

  return (
    <ModuleWorkspace
      definition={data.definition}
      rows={data.rows}
      relations={data.relations}
      error={data.error}
      forbidden={data.forbidden}
      canCreate={data.canCreate}
    />
  );
}
