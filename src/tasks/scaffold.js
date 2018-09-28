/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2018, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const utils = require('../utils.js');
const templates = path.resolve(__dirname, '../templates');

const filterInput = input => String(input)
  .replace(/[^A-z0-9_]/g, '')
  .trim();

const scaffolds = {
  auth: {
    dirname: 'auth',
    title: 'Authentication Adapter',
    info: `
For more information about authentication adapters, visit:
- https://manual.os-js.org/v3/tutorial/auth/
- https://manual.os-js.org/v3/guide/auth/
`
  },
  settings: {
    dirname: 'settings',
    title: 'Settings Adapter',
    info: `
For more information about settings adapters, visit:
- https://manual.os-js.org/v3/tutorial/settings/
- https://manual.os-js.org/v3/guide/settings/
`
  },
  vfs: {
    dirname: 'vfs',
    title: 'VFS Adapter',
    info: `
For more information about vfs adapters, visit:
- https://manual.os-js.org/v3/tutorial/vfs/
- https://manual.os-js.org/v3/guide/filesystem/
`
  },
  providers: {
    dirname: 'provider',
    title: 'Service Provider',
    info: `
For more information about service providers, visit:
- https://manual.os-js.org/v3/tutorial/provider/
- https://manual.os-js.org/v3/guide/provider/
`
  }
};

const ask = (type, s) => inquirer.prompt([{
  name: 'type',
  message: `Select ${s.title} type`,
  type: 'list',
  choices: [{
    name: 'Client-side (ES6+)',
    value: 'client'
  }, {
    name: 'Server-side (nodejs)',
    value: 'server'
  }]
}, {
  name: 'filename',
  message: 'Name of file',
  default: `my-${s.dirname}.js`
}, {
  name: 'target',
  message: 'Destination',
  default: (answers) => {
    return `src/${answers.type}/${type}/${answers.filename}`;
  }
}, {
  name: 'confirm',
  type: 'confirm',
  message: (answers) => `Are you sure you want to write to '${answers.target}'`
}]);

const scaffoldPackage = type => async ({logger, options, args}) => {
  const files = [
    'index.js',
    'server.js',
    'index.scss',
    'webpack.config.js',
    'package.json',
    'metadata.json'
  ];

  const packages = await utils.npmPackages(
    path.resolve(options.root, 'node_modules')
  );

  const promises = (name, dirname) => files.map(filename => {
    const source = path.resolve(templates, 'application', filename);
    const destination = path.resolve(dirname, filename);

    return fs.readFile(source, 'utf8')
      .then(raw => raw.replace(/___NAME___/g, name))
      .then(contents => fs.writeFile(destination, contents))
      .then(() => {
        logger.success('Wrote', filename);
      });
  });

  const choices = await inquirer.prompt([{
    name: 'name',
    message: 'Enter name of package ([A-z0-9_])',
    default: 'MyApplication',
    filter: filterInput,
    validate: input => {
      if (input.length < 1) {
        return Promise.reject('Invalid package name');
      }

      const found = packages.find(({meta}) => meta.name === input);
      if (found) {
        return Promise.reject('A package with this name already exists...');
      }

      return Promise.resolve(true);
    }
  }, {
    name: 'target',
    message: 'Destination',
    default: (answers) => {
      return `src/packages/${answers.name}`;
    }
  }, {
    name: 'confirm',
    type: 'confirm',
    message: (answers) => `Are you sure you want to write to '${answers.target}'`
  }]);

  if (!choices.confirm) {
    logger.warn('Scaffolding aborted...');
    return;
  }


  const destination = path.resolve(options.root, choices.target);
  const exists = await fs.exists(destination);

  if (exists) {
    throw new Error('Destination already exists!');
  }

  await fs.ensureDir(destination);

  return Promise.all(promises(choices.name, destination));
};

const scaffoldBasic = type => async ({logger, options, args}) => {
  logger.await('Scaffolding', type);

  const s = scaffolds[type];
  const choices = await ask(type, s);

  if (!choices.confirm) {
    logger.warn('Scaffolding aborted...');
    return;
  }

  const source = path.resolve(
    templates,
    s.dirname,
    choices.type + '.js'
  );

  const destination = path.resolve(
    options.root,
    choices.target
  );

  const exists = await fs.exists(destination);
  if (exists) {
    throw new Error('Destination already exists!');
  }

  await fs.ensureDir(path.dirname(destination));
  const raw = await fs.readFile(source, 'utf8');
  const contents = `/*${s.info}*/` + raw;
  await fs.writeFile(destination, contents);

  logger.success('Wrote', path.basename(destination));

  console.log(s.info);
};

module.exports = {
  'make:auth': scaffoldBasic('auth'),
  'make:settings': scaffoldBasic('settings'),
  'make:provider': scaffoldBasic('providers'),
  'make:vfs': scaffoldBasic('vfs'),
  'make:application': scaffoldPackage('application'),
  'create:package': ({logger, options, args}) => {
    logger.warn('The task \'create:package\' is deprecated, please use \'make*\' tasks instead');
    return scaffoldPackage('application')({logger, options, args});
  }
};
