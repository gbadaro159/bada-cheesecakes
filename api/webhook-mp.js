// /api/webhook-mp.js
// Webhook chamado pelo servidor do Mercado Pago (não pelo navegador do
// cliente) sempre que o status de um pagamento muda. É a rede de segurança:
// mesmo que o cliente feche o navegador antes de voltar pro site, o pedido
// não fica sem notificação.
//
// Configurar em: Painel Mercado Pago → Sua aplicação → Webhooks
// URL: https://badacheesecakes.com.br/api/webhook-mp
// Eventos: Pagamentos

import { sendOrderEmail } from './_lib/send-order-email.js';

export default async function handler(req, res) {
  // O MP às vezes testa o webhook com GET — responde OK sem processar.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).end();
  }

  try {
    // Dois formatos possíveis de notificação do MP:
    // 1) POST com body: { type: 'payment', data: { id } }
    // 2) Query string (IPN legado): ?topic=payment&id=...
    const body = req.body || {};
    const paymentId =
      body?.data?.id ||
      req.query?.['data.id'] ||
      req.query?.id;
    const type = body?.type || req.query?.topic;

    // Só nos interessa notificação de pagamento — responde 200 pro resto
    // pra não ficar recebendo retries do MP.
    if (type !== 'payment' || !paymentId) {
      return res.status(200).json({ ignored: true });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const payment = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error('Erro ao buscar pagamento:', payment);
      return res.status(200).json({ error: 'payment_fetch_failed' });
    }

    // Só notifica pagamentos aprovados
    if (payment.status !== 'approved') {
      return res.status(200).json({ status: payment.status, skipped: true });
    }

    const orderRaw = payment.metadata?.order_summary;
    if (!orderRaw) {
      // Pagamento aprovado mas sem os dados do pedido na metadata —
      // não temos como montar o email. Loga pra investigar manualmente.
      console.error('Pagamento aprovado sem metadata.order_summary:', payment.id);
      return res.status(200).json({ warning: 'no_order_metadata' });
    }

    const order = JSON.parse(orderRaw);
    await sendOrderEmail({ ...order, source: 'via webhook Mercado Pago' });

    return res.status(200).json({ notified: true });
  } catch (err) {
    console.error('Erro no webhook MP:', err);
    // Sempre 200 pra evitar retries infinitos do MP em caso de bug nosso
    return res.status(200).json({ error: 'internal_error' });
  }
}
