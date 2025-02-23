export default function getTaskPoints(name) {
  const result = {
    value: 0,
    hasQuestion: false,
    hasPlus: false,
  };

  if (!name) return result;

  const chunks = name.split('|').map((chunk) => chunk.trim());

  // Если заголовок задачи не сформирован
  if (chunks.length <= 1) {
    result.hasQuestion = true;
    return result;
  }

  let possibleValue = chunks[chunks.length - 1];

  if (possibleValue.includes('+')) {
    result.hasPlus = true;
  }

  if (possibleValue.includes('?')) {
    result.hasQuestion = true;
  }

  // Оставляем только число
  possibleValue = possibleValue.replace(/[^0-9]/g, '');
 
  result.value = Number(possibleValue);
  return result;
}
