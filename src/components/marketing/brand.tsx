import { BrandLogo } from "@/components/brand/logo";

type BrandProps = {
  inverted?: boolean;
};

export function Brand({ inverted = false }: BrandProps) {
  return <BrandLogo inverted={inverted} />;
}
