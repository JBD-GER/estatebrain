"use client";
import { CreateRecordDialog } from "./module-workspace";
import { DeleteRecordButton } from "./delete-record-button";
import { getModuleDefinition } from "@/lib/modules";
import type { ModuleRow, RelationOptions } from "@/lib/data/modules";

export function RecordActions({module,record,relations,afterDeleteHref}:{module:string;record:ModuleRow;relations?:RelationOptions;afterDeleteHref?:string}) {
  const definition=getModuleDefinition(module);
  if(!definition || !record.id)return null;
  return <div className="flex flex-wrap gap-1"><CreateRecordDialog definition={definition} record={record} relations={relations ?? {properties:[],units:[],tenants:[]}} relationErrors={{}}/><DeleteRecordButton module={module} id={record.id} updatedAt={String(record.updated_at ?? "")} name={String(record.name ?? record.title ?? record.subject ?? record.unit_number ?? definition.title)} afterDeleteHref={afterDeleteHref}/></div>;
}
