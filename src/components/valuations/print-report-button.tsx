"use client";
import { Button } from "@/components/ui/button";
export function PrintReportButton(){return <Button variant="outline" className="print:hidden" onClick={()=>window.print()}>Drucken / als PDF speichern</Button>;}
