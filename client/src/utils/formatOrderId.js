export const formatOrderId = (order) => {
  if (order.orderIdString) return order.orderIdString;
  
  const d = new Date(order.createdAt || Date.now());
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `ORD${dd}${mm}${yy}${hh}${min}${ss}`;
};
