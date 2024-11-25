export default function generateInfoModalsState(groups) {
  return groups.reduce((acc, group) => {
    const recursive = (input) => {
      acc[input.key] = false;

      if (input.children) {
        input.children.forEach(recursive);
      }
    };

    group.inputs.forEach(recursive);

    return acc;
  }, {});
}
