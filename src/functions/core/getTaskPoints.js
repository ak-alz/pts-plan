export default function getTaskPoints(name) {
  const result = {
    value: 0,
    hasQuestion: false,
    hasPlus: false,
  };

  if (!name) return result;

  const chunks = name.split('|').map((chunk) => chunk.trim());
  if (chunks.length <= 1) {
    result.hasQuestion = true;
    return result;
  }

  let possibleValue = chunks[chunks.length - 1];
  if (possibleValue.replace('+', '').length > 2) {
    result.hasQuestion = true;
    return result;
  }

  if (possibleValue.includes('+')) {
    result.hasPlus = true;
  }
  possibleValue = possibleValue.replace('+', '');

  if (possibleValue.includes('?')) {
    result.hasQuestion = true;
  }
  possibleValue = possibleValue.replace('?', '');

  if (isNaN(possibleValue)) return result;

  result.value = Number(possibleValue);
  return result;
}
