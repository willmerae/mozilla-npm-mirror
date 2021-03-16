'use strict';

/**
 * @fileoverview A collection of node package utils.
 */
var Download = require('./download'),
    UrlCheck = require('./urlcheck'),
    debug = require('debug')('npm-mirror:Package'),
    semver = require('semver'),
    url = require('url');


var Package = {
  /**
   * @param {Object} manifest package version object.
   * @param {Array.<string>} types optional list of dependency types ie
   *     'dependencies', 'devDependencies', and 'peerDependencies'.
   * @return {Object} map from dependencies to array of versions we need.
   */
  dependencies: function(manifest, types) {
    if (!types) {
      types = ['dependencies', 'devDependencies', 'peerDependencies'];
    }

    var deps = {};
    types.forEach(function(depType) {
      var depToVersion = manifest[depType];
      if (!depToVersion) {
        return;
      }

      Object.keys(depToVersion).forEach(function(dep) {
        if (!(dep in deps)) {
          deps[dep] = {};
        }

        var version = depToVersion[dep];
        deps[dep][version] = true;
      });
    });

    return deps;
  },

  /**
   * Take an array where each entry is the dependencies for some package
   * and build a single map from dependencies to versions we need for all
   * of the packages.
   *
   * @param {Array} dependencies each entry is the dependencies for some module.
   * @return {Object} map from dependencies to array of versions we need.
   */
  mergeDependencies: function(dependencies) {
    var result = {};
    dependencies.forEach(function(packageToVersions) {
      var packages = Object.keys(packageToVersions);
      packages.forEach(function(pkg) {
        if (!(pkg in result)) {
          result[pkg] = [];
        }

        var versions = Object.keys(packageToVersions[pkg]);
        versions.forEach(function(version) {
          result[pkg][version] = true;
        });
      });
    });

    return result;
  },

  /**
   * Grab the package root object from the master and use it to
   * resolve a loose dependency to an actual version number.
   *
   * @param {string} master npm registry.
   * @param {string} pkg name of package to lookup.
   * @param {string} version unresolved package version.
   * @param {Function} callback [err, version] invoke when done.
   */
  version: function(master, pkg, version, callback) {
    var valid = semver.valid(version);
    if (valid) {
      // Yay! Since it's not a range we don't need to go to the master.
      return callback && callback(null, valid);
    }

    if (UrlCheck.isWebUrl(version) || UrlCheck.isGitUrl(version)) {
      return callback && callback(null, version);
    }

    var packageRootUrl = Package.url(master, pkg);
    Download.inst.download(packageRootUrl, function(e, packageRootData) {
      if (e) {
        return callback && callback(e);
      }

      var packageRoot = JSON.parse(packageRootData);
      var versions = Object.keys(packageRoot.versions);
      var max = semver.maxSatisfying(versions, version);
      if (!max) {
        debug('bad version - ' + pkg + '@' + version);
      }

      return callback && callback(null, max);
    });
  },
  
  /**
   * Resolve the version for all of the package versions.
   *
   * @param {string} master npm registry.
   * @param {Object.<string, Object.<string, boolean>>} packageToVersions map
   *     from package name to object with key list of versions we need for the
   *     package.
   * @param {Function} callback [err, packageToVersions] invoke when done.
   */
  versions: function(master, packageToVersions, callback) {
    var count = Package.versionCount(packageToVersions);
    var result = {};
    if (count === 0) {
      // If there are no versions here, bail.
      return callback && callback(null, result);
    }

    var packages = Object.keys(packageToVersions);
    packages.forEach(function(pkg) {
      result[pkg] = {};

      function onVersion(e, version) {
        if (e) {
          return callback && callback(e);
        }

        result[pkg][version] = true;

        if (--count === 0) {
          return callback && callback(null, result);
        }
      }

      for (var loose in packageToVersions[pkg]) {
        Package.version(master, pkg, loose, onVersion);
      }
    });
  },

  /**
   * Build a url.
   *
   * @param {string} hostname npm registry.
   * @param {string} pkg name of package.
   * @param {string} version optional strict version.
   */
  url: function(hostname, pkg, version) {
    var resource = pkg;
    if (version) {
      resource = resource + '/' + version;
    }

    return url.resolve(hostname, resource);
  },

  /**
   * Uses the npmjs tarball name scheme to build a tarball url.
   *
   * @param {string} hostname npm registry.
   * @param {string} pkg name of package.
   * @param {string} version optional strict version.
   */
  tarballUrl: function(hostname, pkg, version) {
    var tarball = pkg + '-' + version + '.tgz';
    return url.resolve(hostname, [pkg, version, tarball].join('/'));
  },

  /**
   * Count the number of packages in the packageToVersions object.
   *
   * @param {Object.<string, Object.<string, boolean>>} packageToVersions map
   *     from package name to object with key list of versions we need for the
   *     package.
   * @return {number} count of packages.
   */
  versionCount: function(packageToVersions) {
    var count = 0;
    for (var pkg in packageToVersions) {
      count += Object.keys(packageToVersions[pkg]).length;
    }

    return count;
  }
};
module.exports = Package;
