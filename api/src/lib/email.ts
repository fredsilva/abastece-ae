export async function sendMagicLinkEmail(apiKey: string, to: string, link: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Abastece Aê <onboarding@resend.dev>",
      to: [to],
      subject: "Seu link de acesso — Abastece Aê",
      html: `<p>Toque no link abaixo para entrar no Abastece Aê:</p><p><a href="${link}">${link}</a></p><p>O link expira em 15 minutos. Se você não pediu este e-mail, pode ignorá-lo.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao enviar e-mail via Resend: ${res.status} ${body}`);
  }
}
