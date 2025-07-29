export const getTime = (dateObj) => {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return null;
  }

  let hours = dateObj.getHours();
  let minutes = dateObj.getMinutes();
  let seconds = dateObj.getSeconds();
  hours = hours < 10 ? `0${hours}` : hours;
  minutes = minutes < 10 ? `0${minutes}` : minutes;
  seconds = seconds < 10 ? `0${seconds}` : seconds;
  return `${hours}:${minutes}:${seconds}`;
};
