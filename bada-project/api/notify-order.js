// /api/notify-order.js
// Chamada após pagamento confirmado pelo MP
// Envia email para o Bada via Resend (gratuito até 3000 emails/mês)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { cart, customer, dlv, addr, selDate, frete, total } = req.body;

  // ── Monta resumo do pedido ───────────────────────────────────────────────
  const dataEntrega = selDate
    ? new Date(selDate).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })
    : 'A confirmar';

  const itens = cart.map(item => {
    const tamanho = item.sz === 'M' ? 'Médio (8 fatias)' : 'Grande (12 fatias)';
    const extras  = item.extras?.length  ? `\n     Caldas extras: ${item.extras.join(', ')}` : '';
    const toppings= item.toppings?.length ? `\n     Toppings: ${item.toppings.join(', ')}` : '';
    const dobro   = item.dobroCreme ? '\n     ✓ Dobro de creme' : '';
    const custom  = item.tipo === 'personalizada'
      ? `\n     Base: ${item.base} | Creme: ${item.creme} | Calda: ${item.calda}` : '';
    return `• ${item.name} — ${tamanho} x${item.qty} — R$ ${item.total.toFixed(2).replace('.',',')}${custom}${dobro}${extras}${toppings}`;
  }).join('\n');

  const entrega = dlv === 'pickup'
    ? 'Retirada: Rua Emilio Mallet, 95 · Tatuapé'
    : `Entrega: ${addr} (frete: R$ ${frete?.fee?.toFixed(2).replace('.',',')})`;

  const totalFmt = `R$ ${total.toFixed(2).replace('.',',')}`;

  // ── Mensagem WhatsApp (para o cliente enviar ao Bada) ────────────────────
  const msgWpp = encodeURIComponent(
    `🍰 *Novo pedido Badá Cheesecakes*\n\n` +
    `*Itens:*\n${cart.map(i=>`• ${i.name} ${i.sz==='M'?'Médio':'Grande'} x${i.qty}${i.dobroCreme?' + Dobro de creme':''}`).join('\n')}\n\n` +
    `*${entrega}*\n` +
    `*Data:* ${dataEntrega}\n` +
    `*Total pago:* ${totalFmt}\n\n` +
    `Pagamento confirmado via Mercado Pago ✅`
  );

  const wppUrl = `https://wa.me/5511933769243?text=${msgWpp}`;

  // ── Email via Resend ─────────────────────────────────────────────────────
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'pedidos@badacheesecakes.com.br',
        to:   process.env.BADA_EMAIL || 'gabriel@badacheesecakes.com.br',
        subject: `🍰 Novo pedido — ${totalFmt} — ${dataEntrega}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0908;color:#F5F0E8;padding:32px;border-radius:8px">
            <h1 style="color:#C41E24;font-size:28px;margin-bottom:4px">Novo pedido!</h1>
            <p style="color:#C9A96E;margin-bottom:24px">${dataEntrega}</p>

            <div style="background:#1A1610;padding:20px;border-radius:6px;margin-bottom:20px">
              <h3 style="color:#C9A96E;margin-bottom:12px">Itens do pedido</h3>
              <pre style="color:#F5F0E8;font-size:13px;white-space:pre-wrap;margin:0">${itens}</pre>
            </div>

            <div style="background:#1A1610;padding:20px;border-radius:6px;margin-bottom:20px">
              <h3 style="color:#C9A96E;margin-bottom:8px">Entrega</h3>
              <p style="margin:0;font-size:14px">${entrega}</p>
            </div>

            <div style="background:#C41E24;padding:16px;border-radius:6px;text-align:center">
              <p style="margin:0;font-size:18px;font-weight:bold">Total pago: ${totalFmt}</p>
              <p style="margin:4px 0 0;font-size:12px;opacity:.8">Pagamento confirmado via Mercado Pago</p>
            </div>

            <div style="margin-top:20px;text-align:center">
              <a href="${wppUrl}" style="background:#25D366;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px">
                Abrir no WhatsApp
              </a>
            </div>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error('Resend error:', err);
    }
  } catch(e) {
    console.error('Email error:', e);
  }

  // Sempre retorna o link do WhatsApp — fallback garantido
  return res.status(200).json({ wppUrl });
}
