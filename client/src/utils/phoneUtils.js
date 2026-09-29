/**
 * Utility functions for Guinean Phone Numbers (+224)
 * Standard national format: +224 6XX XX XX XX (9 digits after country code)
 */

export function formatGuineaPhone(rawVal) {
  if (!rawVal && rawVal !== 0) return '';
  
  let str = String(rawVal).trim();
  if (!str) return '';

  // If user only typed '+', '+2', '+22', '+224', return '+224 '
  if (['+', '+2', '+22', '+224', '+224 '].includes(str)) {
    return '+224 ';
  }

  // Remove everything except digits
  let digits = str.replace(/\D/g, '');

  // Strip international prefix 224 or 00224
  if (digits.startsWith('00224')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('224')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length > 1) {
    // If local number like 0621...
    digits = digits.slice(1);
  }

  // Cap at 9 digits (Guinea standard)
  digits = digits.slice(0, 9);

  if (digits.length === 0) {
    return str.includes('+') ? '+224 ' : '';
  }

  // Format as +224 NNN NN NN NN
  let formatted = '+224 ';
  if (digits.length <= 3) {
    formatted += digits;
  } else if (digits.length <= 5) {
    formatted += digits.slice(0, 3) + ' ' + digits.slice(3);
  } else if (digits.length <= 7) {
    formatted += digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5);
  } else {
    formatted += digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 7) + ' ' + digits.slice(7, 9);
  }

  return formatted;
}

export function handleGuineaPhoneChange(e, setter) {
  const inputVal = e.target.value;
  // If user deleted everything or cleared input
  if (!inputVal || inputVal === '+' || inputVal === '+2' || inputVal === '+22') {
    setter('');
    return;
  }
  const formatted = formatGuineaPhone(inputVal);
  setter(formatted);
}
