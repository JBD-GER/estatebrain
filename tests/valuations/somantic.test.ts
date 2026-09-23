import { describe, expect, it } from "vitest";
import { somanticRequestBody, valuationAvailability, valuationFilterLabel, valuationDefaults, valuationInputSchema, valuationResponseSchema } from "@/lib/valuations/somantic";
const input={typ:"wohnung",street:"Marienplatz 1",postcode:"80331",city:"München",square_meters:75};
describe("Somantic contract",()=>{
  it("rejects missing data before consuming a provider request",()=>{
    for(const field of ["typ","street","postcode","city","square_meters"]){
      expect(valuationInputSchema.safeParse({...input,[field]:""}).success).toBe(false);
    }
    expect(valuationInputSchema.safeParse({...input,postcode:"8033"}).success).toBe(false);
    expect(valuationInputSchema.safeParse({...input,square_meters:-1}).success).toBe(false);
  });
  it("preserves leading zero postcodes and optional unknowns",()=>{
    const parsed=valuationInputSchema.parse({...input,postcode:"01067",rooms:"",year_of_construction:"",rented:false});
    expect(parsed.postcode).toBe("01067");expect(parsed.rooms).toBeUndefined();expect(parsed.rented).toBe(false);
  });
  it("only accepts an appropriate residential subtype",()=>{
    expect(valuationInputSchema.safeParse({...input,property_type:"mehrfamilienhaus"}).success).toBe(false);
    expect(valuationInputSchema.safeParse({...input,property_type:"etagenwohnung"}).success).toBe(true);
  });
  it("does not invent living area from a commercial or unspecified total",()=>{
    expect(valuationDefaults({total_area_sqm:150,rentable_area_sqm:140,property_type:"commercial"}).square_meters).toBeUndefined();
    expect(valuationDefaults({property_type:"terraced_house"}).property_type).toBe("reihenhaus");
  });
  it("keeps insufficient-data responses without turning null into a zero valuation",()=>{
    const parsed=valuationResponseSchema.parse({estimates:{price:null,rent:null,price_range:null,similar_properties:[{private:"discard"}]},confidence:{price:"none",rent:"none",sample_size:3}});
    expect(parsed.estimates.price).toBeNull();expect(parsed.estimates).not.toHaveProperty("similar_properties");
  });
  it("rejects malformed successful responses",()=>{
    expect(valuationResponseSchema.safeParse({estimates:{price:-1},confidence:{price:"high",rent:"high",sample_size:5}}).success).toBe(false);
    expect(valuationResponseSchema.safeParse({}).success).toBe(false);
  });
  it("keeps existing reports detailed and sends only supported provider fields",()=>{
    const parsed=valuationInputSchema.parse({...input,property_type:"erdgeschosswohnung",features:{balcony:true},rented:false});
    expect(parsed.comparison_scope).toBe("detailed");
    expect(somanticRequestBody(parsed)).toMatchObject({property_type:"erdgeschosswohnung",features:{balcony:true},rented:false});
    expect(somanticRequestBody(parsed)).not.toHaveProperty("comparison_scope");
  });
  it("broadens only optional subtype and equipment filters without changing the property facts",()=>{
    const parsed=valuationInputSchema.parse({...input,comparison_scope:"broader",property_type:"erdgeschosswohnung",features:{balcony:true},rented:true,rooms:2,year_of_construction:1974});
    expect(somanticRequestBody(parsed)).toEqual({...input,rented:true,rooms:2,year_of_construction:1974});
    expect(parsed.property_type).toBe("erdgeschosswohnung");
    expect(parsed.features?.balcony).toBe(true);
    expect(valuationInputSchema.safeParse({...input,comparison_scope:"automatic"}).success).toBe(false);
  });
  it("explains Nienburg's missing purchase price separately from the available rental estimate",()=>{
    const response=valuationResponseSchema.parse({estimates:{price:null,rent:564,price_per_square_meter:{count:3,mean:2103.57},rent_per_square_meter:{count:6,mean:8.68}},confidence:{price:"low",rent:"low",sample_size:9}});
    expect(valuationAvailability(response,"price")).toContain("Kauf: 3 passende Vergleichsobjekte");
    expect(valuationAvailability(response,"price")).toContain("mindestens 5");
    expect(valuationAvailability(response,"rent")).toBeNull();
    expect(response.estimates.price).toBeNull();
  });
  it("does not invent a comparison count if the provider omits statistics",()=>{
    const response=valuationResponseSchema.parse({estimates:{price:251252,rent:null},confidence:{price:"medium",rent:"none",sample_size:25}});
    expect(valuationAvailability(response,"rent")).toContain("keine Vergleichsanzahl");
    expect(valuationAvailability(response,"price")).toBeNull();
  });
  it("shows understandable filter labels with a fallback for unknown provider filters",()=>{
    expect(valuationFilterLabel("property_type=erdgeschosswohnung")).toBe("Objektart: Erdgeschosswohnung");
    expect(valuationFilterLabel("tenancy=rented")).toBe("Vermietete Kaufobjekte");
    expect(valuationFilterLabel("recency=12m")).toBe("Inserate der letzten 12 Monate");
    expect(valuationFilterLabel("parking")).toBe("Stellplatz");
    expect(valuationFilterLabel("future_filter=x")).toBe("future_filter=x");
  });
});
