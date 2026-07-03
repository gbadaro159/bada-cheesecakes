// /api/create-preference.js — função serverless na Vercel
// O Access Token fica aqui no servidor, nunca exposto no frontend

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items, payer, back_urls } = req.body;

  try {
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items,
        payer,
        back_urls: {
          success: back_urls?.success || 'https://badacheesecakes.com.br/?status=success',
          failure: back_urls?.failure || 'https://badacheesecakes.com.br/?status=failure',
          pending: back_urls?.pending || 'https://badacheesecakes.com.br/?status=pending',
        },
        auto_return: 'approved',
        statement_descriptor: 'BADA CHEESECAKES',
        payment_methods: {
          excluded_payment_types: [],
          installments: 1,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('MP Error:', data);
      return res.status(400).json({ error: data.message || 'Erro ao criar preferência' });
    }

    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,         // produção
      sandbox_init_point: data.sandbox_init_point, // teste
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
