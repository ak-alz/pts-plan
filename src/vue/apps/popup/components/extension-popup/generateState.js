export default function generateState(groups) {
  return groups.reduce((acc, group) => {
    const recursive = (input) => {
      acc[input.key] = input.default;

      if (input.children) {
        input.children.forEach(recursive);
      }
    };

    group.inputs.forEach(recursive);

    return acc;
  }, {});
}
