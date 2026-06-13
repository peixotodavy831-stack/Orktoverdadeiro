export const formatCurrency = (amount: number): string => {
  if (isNaN(amount) || amount === undefined || amount === null) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatBRL = (amount: number): string => {
  return `R$ ${formatCurrency(amount)}`;
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const getCleanPhoneForWhatsApp = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  // If it already has the 55 country code prefix (12 or 13 digits)
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  return `55${cleaned}`;
};

