const Order = require('../models/Order');

const STATUS_VALUES = Order.ALLOWED_STATUSES;

const ROLE_ALLOWED_STATUS_MAP = Object.freeze({
  picker: [...Order.PICKER_ALLOWED_STATUSES],
  rider: [...Order.RIDER_ALLOWED_STATUSES],
  admin: [...STATUS_VALUES],
  customer: ['Cancelled']
});

const getRoleKey = (role) => String(role || '').trim().toLowerCase();

const getAllowedStatusSetForRole = (role) => {
  const roleKey = getRoleKey(role);
  const allowed = ROLE_ALLOWED_STATUS_MAP[roleKey];
  return new Set(Array.isArray(allowed) ? allowed : []);
};

const canRoleSetStatus = (role, status) => getAllowedStatusSetForRole(role).has(status);

const serializeOrder = (order) => {
  if (!order) return null;
  const data = typeof order.toObject === 'function' ? order.toObject() : { ...order };
  delete data.__v;
  return data;
};

const applyStatusChange = async ({ order, status, actor }) => {
  if (!order) throw new Error('Order document required');
  if (!STATUS_VALUES.includes(status)) throw new Error('Invalid status value');
  if (!actor || !actor.type || !actor.id || !actor.role) throw new Error('Invalid actor payload');

  if (order.status === status) {
    return order;
  }

  if (status === 'Cancelled' && order.payment && order.payment.status !== 'Cancelled') {
    order.payment.status = 'Cancelled';
  }

  order.status = status;
  order.statusHistory.push({
    status,
    updatedBy: {
      user: actor.type === 'user' ? actor.id : null,
      partner: actor.type === 'partner' ? actor.id : null,
      role: actor.role
    },
    updatedAt: new Date()
  });

  await order.save();
  return order;
};

const getVisibleStatusesForRole = (role) => {
  const roleKey = getRoleKey(role);
  if (roleKey === 'picker') {
    return Array.from(new Set(['Pending', ...ROLE_ALLOWED_STATUS_MAP.picker]));
  }
  if (roleKey === 'rider') {
    return Array.from(new Set(['Assigned', ...ROLE_ALLOWED_STATUS_MAP.rider]));
  }
  return [...STATUS_VALUES];
};

module.exports = {
  STATUS_VALUES,
  ROLE_ALLOWED_STATUS_MAP,
  canRoleSetStatus,
  applyStatusChange,
  getVisibleStatusesForRole,
  getAllowedStatusesForRole: (role) => Array.from(getAllowedStatusSetForRole(role)),
  serializeOrder
};