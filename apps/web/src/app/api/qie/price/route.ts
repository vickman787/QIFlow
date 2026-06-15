import { getQiePriceUSD, QIE_PRICE_SOURCE, WQIE_ADDRESS } from '@/lib/qie-price';

export async function GET() {
  try {
    const priceUSD = await getQiePriceUSD();

    return Response.json({
      qie: {
        priceUSD,
        priceSource: QIE_PRICE_SOURCE,
        wrappedToken: WQIE_ADDRESS,
      },
    });
  } catch (err) {
    console.error('[qie/price]', err);
    return Response.json({ error: 'Failed to fetch QIE price' }, { status: 500 });
  }
}
