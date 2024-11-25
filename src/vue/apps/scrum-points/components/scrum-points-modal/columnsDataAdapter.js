export default function columnsDataAdapter(columns) {
  return columns.map((column) => ({
    id: column.id,
    name: column.name,
    color: `#${column.color}`,
    total: column.total,
  }));
}
