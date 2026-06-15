export const QIE_PRICE_SOURCE = 'QIE DEX WQIE/QUSDC subgraph';
export const QIE_DEX_SUBGRAPH = 'https://graphql.qie.digital/subgraphs/name/qie-dex/dex';
export const WQIE_ADDRESS = '0x0087904d95bee9e5f24dc8852804b547981a9139';

export async function getQiePriceUSD() {
  const res = await fetch(QIE_DEX_SUBGRAPH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query TokenPrice($id: ID!) {
          token(id: $id) {
            derivedQUSDC
          }
        }
      `,
      variables: { id: WQIE_ADDRESS },
    }),
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`DEX subgraph error: ${res.status}`);

  const data = await res.json();
  const priceText = data?.data?.token?.derivedQUSDC;
  const price = Number.parseFloat(priceText);

  return Number.isFinite(price) && price > 0 ? price : null;
}
