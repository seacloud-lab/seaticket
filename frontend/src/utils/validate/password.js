export const evaluatePasswordStrength = (password) => {
  let strength = 0;
  const length = password.length;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[`~!@#$%^&*()_\-+=<>?:"{}|,./;'\\]/.test(password);

  // Increased strength based on length
  if (length === 0) return 'empty';
  if (length >= 16) strength += 4;
  else if (length >= 12) strength += 3;
  else if (length >= 8) strength += 2;
  else if (length >= 6) strength += 1;

  // Increased strength based on character type
  if (hasUppercase) strength += 1;
  if (hasLowercase) strength += 1;
  if (hasNumbers) strength += 1;
  if (hasSpecialChars) strength += 1;

  // Determine password strength
  if (strength >= 8) return 'very_strong';
  if (strength >= 6) return 'strong';
  if (strength >= 4) return 'medium';
  return 'weak';
};

export const isValidPassword = (password) => {
  const { userStrongPasswordRequired } = window.app.pageOptions;
  const passwordStrength = evaluatePasswordStrength(password);
  const requiredStrengths = userStrongPasswordRequired ? ['strong', 'very_strong'] : ['medium', 'strong', 'very_strong'];
  return requiredStrengths.includes(passwordStrength);
};
