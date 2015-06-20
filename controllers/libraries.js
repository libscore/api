function *badge(id, next) {
  this.body = {};
};

function *index(next) {
  this.body = [];
};

function *search(query, next) {
  this.body = [];

};

function *show(name, next) {
  this.body = {};
};


module.exports = {
  badge: badge,
  index: index,
  search: search,
  show: show
};
