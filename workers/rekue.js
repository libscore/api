var async = require('async');
var kue = require('kue');

var queue = kue.createQueue({
  redis: { auth: process.env.LIBSCORE_REDIS_PASS }
});
queue.failed(function(err, ids) {
  async.eachLimit(ids, 10, function(id, callback) {
    kue.Job.get(id, function(err, job) {
      if (err || !job) return;
      job.data.priority += 1;
      if (job.data.priority < 3) {
        var newJob = queue.create('website', job.data).priority(job.data.priority).ttl(60*1000);
        process.nextTick(function() {
          job.remove();
          newJob.save(callback);
        });
      }
    });
  })
});
