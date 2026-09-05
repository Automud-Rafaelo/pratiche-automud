export function getWhatsAppUrl() {
  const number = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(
    /\D/g,
    "",
  );
  return number ? `https://wa.me/${number}` : "https://wa.me/";
}
