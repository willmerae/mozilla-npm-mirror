var debug = require('debug')('maybeMkdir'),
    fs = require('graceful-fs'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf');


/**
 * Make the directory if it doesn't exist.
 *
 * @param {string} path to directory.
 * @param {Object} opts optional args.
 *   purge (boolean) - whether or not to purge existing files.
 * @param {Function} callback invoke when done.
 */
function maybeMkdir(path, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }

  fs.exists(path, function(exists) {
    if (opts && opts.purge) {
      rimraf.sync(path);
    } else {
      if (exists) {
        return callback && callback();
      }
    }
    mkdirp(path, (err, made) => {
      if (err) {
        return callback && callback(err);
      }
      debug(made);
      return callback(null);
    });
  });
}
module.exports = maybeMkdir;
