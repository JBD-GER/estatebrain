import { notFound, redirect } from "next/navigation";
import { ModuleWorkspace } from "@/components/app/module-workspace";
import { getModulePageData } from "@/lib/data/modules";
import { allowedModuleSlugs } from "@/lib/modules";

export function generateStaticParams() {
  return allowedModuleSlugs.map((module) => ({ module }));
}

export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ property?: string; create?: string }>;
}) {
  const { module } = await params;
  if (module === "ausgaben") {
    redirect("/app/belege");
  }

  const data = await getModulePageData(module);
  if (!data) notFound();
  const query = await searchParams;
  const propertyId = data.relations.properties.some(
    (property) => property.value === query.property,
  )
    ? query.property
    : undefined;

  return (
    <ModuleWorkspace
      definition={data.definition}
      rows={data.rows}
      relations={data.relations}
      relationErrors={data.relationErrors}
      error={data.error}
      forbidden={data.forbidden}
      canCreate={data.canCreate}
      initialFieldValues={
        propertyId ? { property_id: propertyId } : undefined
      }
      initiallyOpenCreate={query.create === "1" && Boolean(propertyId)}
    />
  );
}
