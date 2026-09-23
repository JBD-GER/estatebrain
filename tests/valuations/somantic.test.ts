import { describe, expect, it } from "vitest";
import { berlinYear, valuationDefaults, valuationInputSchema, valuationResponseSchema } from "@/lib/valuations/somantic";
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
  it("resets quota on the Berlin calendar-year boundary",()=>{
    expect(berlinYear(new Date("2026-12-31T22:59:59Z"))).toBe(2026);
    expect(berlinYear(new Date("2026-12-31T23:00:00Z"))).toBe(2027);
  });
});
