function *index(next) {
  this.body = {};
};

function *show(name, next) {
  this.body = {};
};


module.exports = {
  index: index,
  show: show
};
