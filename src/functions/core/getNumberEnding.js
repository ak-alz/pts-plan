export default function getNumberEnding(number, words) {
  number %= 100;

  if (number >= 11 && number <= 19) {
    return words[2];
  }

  const digit = number % 10;
  switch (digit) {
  case 1: {
    return words[0];
  }
  case 2:
  case 3:
  case 4: {
    return words[1];
  }
  default: {
    return words[2];
  }
  }
}
