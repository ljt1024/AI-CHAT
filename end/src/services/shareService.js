const shareList = [];

function getSharedMessage(id) {
  return shareList.find((item) => item.id === id) || null;
}

function createShare(payload) {
  shareList.push(payload);
}

module.exports = {
  createShare,
  getSharedMessage,
};
