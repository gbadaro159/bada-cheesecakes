// /api/notify-order.js
// Chamada pelo navegador do cliente assim que o Mercado Pago redireciona
// de volta com status=success. É o caminho "rápido" — o /api/webhook-mp.js
// é a rede de segurança caso o cliente feche o navegador antes disso.

import { sendOrderEmail } from './_lib/send-order-email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { cart, customer, dlv, addr, selDate, frete, total } = req.body;

  const { wppUrl } = await sendOrderEmail({
    cart, customer, dlv, addr, selDate, frete, total,
    source: 'via navegador',
  });

  return res.status(200).json({ wppUrl });
}
