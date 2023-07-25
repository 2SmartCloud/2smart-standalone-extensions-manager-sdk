// eslint-disable-next-line security/detect-child-process
const childProcess  = require('child_process');
const { promisify } = require('util');
const fs            = require('fs');
const X             = require('homie-sdk/lib/utils/X');

require('isomorphic-fetch'); // assign fetch to global scope

module.exports = {
    // eslint-disable-next-line security/detect-child-process
    exec     : promisify(childProcess.exec),
    exists   : (path) => new Promise(resolve => fs.stat(path, err => resolve(!err || err.code !== 'ENOENT'))),
    opendir  : fs.promises.opendir,
    readfile : fs.promises.readFile,
    X
};
