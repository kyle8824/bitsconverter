import { createFileRoute } from "@tanstack/react-router";
import { BitsConverter } from "@/components/bits-converter";
import { fetchBtcPrice, type BtcPrice } from "@/lib/btc-price";

export const Route = createFileRoute("/")({
  loader: async (): Promise<BtcPrice | null> => {
    try {
      return await fetchBtcPrice();
    } catch {
      return null;
    }
  },
  component: Home,
});

function Home() {
  const initialPrice = Route.useLoaderData();
  return <BitsConverter initialPrice={initialPrice} />;
}
