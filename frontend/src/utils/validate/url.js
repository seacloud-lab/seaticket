
export const isValidUrl = (url) => {
  const reg = /^(([-a-zA-Z0-9+.]+):\/\/)[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/;

  return reg.test(url);
};
