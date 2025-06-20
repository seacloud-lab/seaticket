export const isWorkWeChat = (ua) => {
  if (ua.includes('micromessenger') && ua.includes('wxwork')) {
    return true;
  }
  return false;
};
