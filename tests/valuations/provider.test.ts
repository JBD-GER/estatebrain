import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requestSomanticValuation, ValuationProviderError } from "@/lib/valuations/provider";
import { propertyTypes, valuationInputSchema } from "@/lib/valuations/somantic";

const successful = { estimates: {price:120010,rent:531}, confidence:{price:"low",rent:"medium",sample_size:32} };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function provider(body: unknown, status=200) {
  vi.stubEnv("SOMANTIC_API_KEY", "test-key");
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status}));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("Somantic provider for all supported residential types", () => {
  it.each(propertyTypes)("keeps %s property data but broadens the API comparison", async (propertyType, _label, typ) => {
    const fetcher = provider(successful);
    const input=valuationInputSchema.parse({typ,street:"Teststraße 1",postcode:"31582",city:"Nienburg",square_meters:65,rooms:2,year_of_construction:1974,rented:true,property_type:propertyType,features:{parking:true},comparison_scope:"broader"});
    const result=await requestSomanticValuation(input);
    expect(result.estimates.price).toBe(120010);
    const sent=JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent).toEqual({typ,street:"Teststraße 1",postcode:"31582",city:"Nienburg",square_meters:65,rooms:2,year_of_construction:1974,rented:true});
    expect(input.property_type).toBe(propertyType);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("returns partial and sparse responses without fabricating missing prices", async () => {
    const fetcher=provider({...successful,estimates:{price:null,rent:564,price_per_square_meter:{count:3,mean:2103.57}}});
    const result=await requestSomanticValuation(valuationInputSchema.parse({typ:"wohnung",street:"Teststraße 1",postcode:"31582",city:"Nienburg",square_meters:65}));
    expect(result.estimates.price).toBeNull();
    expect(result.estimates.rent).toBe(564);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([400,402,403,422,429])("allows a later retry after an explicit %i rejection without looping", async status => {
    const fetcher=provider({detail:"Rejected"},status);
    await expect(requestSomanticValuation(valuationInputSchema.parse({typ:"haus",street:"Teststraße 1",postcode:"31582",city:"Nienburg",square_meters:100}))).rejects.toMatchObject({retryable:true});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not blindly retry a timeout or consume another billable request", async () => {
    vi.stubEnv("SOMANTIC_API_KEY", "test-key");
    const fetcher=vi.fn().mockRejectedValue(new DOMException("Timed out","TimeoutError"));vi.stubGlobal("fetch",fetcher);
    await expect(requestSomanticValuation(valuationInputSchema.parse({typ:"haus",street:"Teststraße 1",postcode:"31582",city:"Nienburg",square_meters:100}))).rejects.toMatchObject({retryable:false});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed provider responses as unconfirmed", async () => {
    provider({estimates:{price:"not a price"}});
    await expect(requestSomanticValuation(valuationInputSchema.parse({typ:"haus",street:"Teststraße 1",postcode:"31582",city:"Nienburg",square_meters:100}))).rejects.toBeInstanceOf(ValuationProviderError);
  });
});
