'use strict';

const clone = require('clone');
const traverse = require('xcraft-traverse');

exports.stringify = function (wizardPath) {
  const wizard = clone(require(wizardPath), false);

  /* replace all func by a promise */
  traverse(wizard).forEach(function (value) {
    if (this.key === 'xcraftCommands') {
      return;
    }
    if (typeof value === 'function') {
      this.update(
        `__begin__
        function (arg) {
          var done = this.async ();
          const cmd = 'wizard.${this.path[0]}.${
          wizard[this.path[0]][this.path[1]].name
        }.${this.key}';
          busClient.command.send (cmd, arg, null, function (err, res) {
            done (res.data);
          });
        }
      __end__`
      );
    }
  });

  return JSON.stringify(wizard)
    .replace(/("__begin__|__end__")/g, '')
    .replace(/\\n[ ]*/g, '\n');
};

exports.commandify = function (module) {
  const cmd = {};
  const rc = {};

  function tryPushFunction(fieldDef, category, funcName) {
    if (!fieldDef.hasOwnProperty(funcName)) {
      return;
    }

    /* generating cmd and result event name */
    const cmdName = category + '.' + fieldDef.name + '.' + funcName;
    const evtName = `wizard.${category}.${fieldDef.name}.${funcName}`;

    cmd[cmdName] = function (msg, resp) {
      /* execute function */
      const result = fieldDef[funcName](msg.data);
      resp.events.send(`${evtName}.${msg.id}.finished`, result);
    };
    rc[cmdName] = {
      parallel: true,
    };
  }

  function extractCommandsHandlers(category) {
    const fields = module[category];

    Object.keys(fields).forEach(function (index) {
      const fieldDef = fields[index];

      tryPushFunction(fieldDef, category, 'validate');
      tryPushFunction(fieldDef, category, 'choices');
      tryPushFunction(fieldDef, category, 'filter');
      tryPushFunction(fieldDef, category, 'when');
    });
  }

  /* extacts cmds handlers for each category */
  Object.keys(module).forEach(function (exp) {
    if (exp !== 'xcraftCommands') {
      extractCommandsHandlers(exp);
    }
  });

  return {
    handlers: cmd,
    rc: rc,
  };
};
