const STATUSES = [
  'wishlist',
  'applied',
  'phone_screen',
  'technical',
  'onsite',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
];

const VALID_TRANSITIONS = {
  wishlist:     ['applied', 'withdrawn'],
  applied:      ['phone_screen', 'rejected', 'withdrawn'],
  phone_screen: ['technical', 'rejected', 'withdrawn'],
  technical:    ['onsite', 'rejected', 'withdrawn'],
  onsite:       ['offer', 'rejected', 'withdrawn'],
  offer:        ['accepted', 'rejected', 'withdrawn'],
  accepted:     [],
  rejected:     [],
  withdrawn:    [],
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function getNextStatuses(status) {
  return VALID_TRANSITIONS[status] || [];
}

function isTerminal(status) {
  return getNextStatuses(status).length === 0;
}

module.exports = {
  STATUSES,
  VALID_TRANSITIONS,
  canTransition,
  getNextStatuses,
  isTerminal,
};