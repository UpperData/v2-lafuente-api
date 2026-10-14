function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createNewUserCredentialsEmail({ email, password }) {
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);

  return {
    subject: 'Bienvenido a La Fuente - tus credenciales',
    text: [
      'Bienvenido a La Fuente.',
      '',
      'Tu cuenta ha sido creada. Puedes ingresar con estas credenciales:',
      `Correo: ${email}`,
      `Contraseña: ${password}`,
      '',
      'Por seguridad, cambia tu contraseña después de iniciar sesión.',
    ].join('\n'),
    html: `
      <div style="background-color:#f4f6f8;padding:32px 16px;font-family:Arial,sans-serif;color:#25313c">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
          <div style="text-align:center;margin-bottom:24px">
            <img src="cid:logo-fuente" alt="La Fuente" style="max-width:180px;height:auto">
          </div>
          <h1 style="font-size:22px;margin:0 0 16px">Bienvenido a La Fuente</h1>
          <p style="font-size:15px;line-height:1.6">Tu cuenta ha sido creada. Usa estas credenciales para iniciar sesión:</p>
          <div style="background:#f4f6f8;border-radius:8px;padding:16px;margin:24px 0">
            <p style="margin:0 0 12px"><strong>Correo:</strong> ${safeEmail}</p>
            <p style="margin:0"><strong>Contraseña:</strong> ${safePassword}</p>
          </div>
          <p style="font-size:13px;line-height:1.6;color:#5d6973">Por seguridad, cambia tu contraseña después de iniciar sesión.</p>
        </div>
      </div>
    `,
  };
}
