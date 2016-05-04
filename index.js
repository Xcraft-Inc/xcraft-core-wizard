'use strict';

const clone    = require ('clone');
const traverse = require ('traverse');


exports.stringify = function (wizardPath) {
  const wizard = clone (require (wizardPath), false);

  /* replace all func by a promise */
  traverse (wizard).forEach (function (value) {
    if (this.key === 'xcraftCommands') {
      return;
    }
    if (typeof value === 'function') {
      this.update (`__begin__
        function (arg) {
          var done = this.async ();
          const cmd = 'wizard.${this.path[0]}.${wizard[this.path[0]][this.path[1]].name}.${this.key}';
          busClient.command.send (cmd, arg, null, function (err, res) {
            done (res.data);
          });
        }
      __end__`);
    }
  });

  return JSON.stringify (wizard)
    .replace (/("__begin__|__end__")/g, '')
    .replace (/\\n[ ]*/g, '\n');
};
