/**
 * Check email format is valid.
 * @param {string} email
 * @returns true/false, bool
 */
const emailPattern = /^[A-Za-z0-9]+([-_.][A-Za-z0-9]+)*@([A-Za-z0-9]+[-.])+[A-Za-z0-9]{2,20}$/;
const emailWithDisplayNamePattern = /^.+ <([^<>]+)>$/;

const isValidEmail = (email) => {
  const emailValue = String(email);
  const emailAddress = emailWithDisplayNamePattern.exec(emailValue)?.[1] || emailValue;

  return emailPattern.test(emailAddress);
};

export { isValidEmail };
