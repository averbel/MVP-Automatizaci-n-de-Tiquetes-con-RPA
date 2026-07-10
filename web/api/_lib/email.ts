export const sendApprovalEmail = async (
  aprobadorEmail: string,
  trabajadorNombre: string,
  destino: string,
  tokenId: string,
  solicitudId: string
) => {
  // En un entorno real, aquí usaríamos Resend, SendGrid, etc.
  // Por ahora lo simularemos con un console.log para el MVP o demostración local.
  const acceptLink = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/api/aprobacion/aceptar?token=${tokenId}`;
  const rejectLink = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/api/aprobacion/rechazar?token=${tokenId}`;
  
  console.log(`
  ===========================================
  📧 SIMULACIÓN DE ENVÍO DE CORREO 
  ===========================================
  Para: ${aprobadorEmail}
  Asunto: Aprobación de viaje para ${trabajadorNombre} a ${destino}
  
  Hola,
  ${trabajadorNombre} ha solicitado un viaje a ${destino}.
  Por favor, aprueba o rechaza la solicitud utilizando los siguientes enlaces:
  
  ✅ ACEPTAR:
  ${acceptLink}
  
  ❌ RECHAZAR:
  ${rejectLink}
  ===========================================
  `);
  
  return true;
};
