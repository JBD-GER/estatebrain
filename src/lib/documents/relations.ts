export type DocumentRelationSelection = {
  propertyId?: string;
  renovationProjectId?: string;
  unitId?: string;
  leaseId?: string;
  tenantVisible: boolean;
};

export type DocumentRelationRecords = {
  property: { id: string } | null;
  renovation?: {id:string;property_id:string} | null;
  unit: { id: string; property_id: string } | null;
  lease: { id: string; unit_id: string } | null;
};

export function validateDocumentRelationSelection(
  selection: DocumentRelationSelection,
  records: DocumentRelationRecords,
) {
  if (selection.propertyId && records.property?.id !== selection.propertyId) {
    return "Die ausgewählte Immobilie ist nicht verfügbar.";
  }

  if (selection.renovationProjectId && (records.renovation?.id !== selection.renovationProjectId || records.renovation.property_id !== selection.propertyId)) return "Die Sanierung gehört nicht zur ausgewählten Immobilie.";

  if (selection.unitId) {
    if (!selection.propertyId) {
      return "Eine Einheit benötigt eine Immobilienzuordnung.";
    }
    if (
      records.unit?.id !== selection.unitId ||
      records.unit.property_id !== selection.propertyId
    ) {
      return "Die ausgewählte Einheit gehört nicht zur Immobilie.";
    }
  }

  if (selection.leaseId) {
    if (!selection.unitId) {
      return "Ein Mietverhältnis benötigt eine Einheitenzuordnung.";
    }
    if (
      records.lease?.id !== selection.leaseId ||
      records.lease.unit_id !== selection.unitId
    ) {
      return "Das ausgewählte Mietverhältnis gehört nicht zur Einheit.";
    }
  }

  if (selection.tenantVisible && !selection.leaseId) {
    return "Für die Sichtbarkeit im Mieterportal ist ein Mietverhältnis erforderlich.";
  }

  return null;
}
