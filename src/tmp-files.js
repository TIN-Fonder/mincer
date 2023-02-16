import fs from 'fs/promises';
import path from 'path';

const checkIfExist = async (p) => fs.access(p).then(() => true).catch(() => false);

function error(...args) {
  // eslint-disable-next-line no-console
  console.error('ERROR tmp files:', ...args);
}

async function getTmpPath() {
  const tmpDirName = '.mincer';

  // loop parent directories until we find a .git directory or package.json
  let dir = process.cwd();
  let err = null;

  while (dir !== '/' || err !== null) {
    const gitDir = path.join(dir, '.git');
    const packageJson = path.join(dir, 'package.json');
    const useDir = path.join(dir, tmpDirName);
    if (await checkIfExist(gitDir) || await checkIfExist(packageJson)) {
      if (!await checkIfExist(useDir)) {
        try {
          await fs.mkdir(useDir);
        } catch (e) {
          err = e;
        }
      }
      return useDir;
    }
    dir = dir.substring(0, dir.lastIndexOf('/'));
  }

  // if we have an error, try to create a folder in /tmp
  if (err) {
    const tmpDir = '/tmp';
    try {
      if (await checkIfExist(tmpDir)) {
        const useDir = path.join(tmpDir, tmpDirName);
        if (!await checkIfExist(useDir)) {
          await fs.mkdir(useDir);
        }

        return useDir;
      }
    } catch (e) {
      error(`could not create ${tmpDirName} directory in /tmp`, e);
      return null;
    }
  }

  return null;
}

async function readTmpFile(filename) {
  const tmpDir = await getTmpPath();
  let tmpFile = null;
  if (tmpDir) {
    tmpFile = path.join(tmpDir, filename);
    return fs.readFile(tmpFile);
  }
  error('could not read tmp file', filename);
  return null;
}

async function writeTmpFile(filename, data) {
  const tmpDir = await getTmpPath();
  let tmpFile = null;
  if (tmpDir) {
    tmpFile = path.join(tmpDir, filename);
    return fs.writeFile(tmpFile, data);
  }
  error('could not write tmp file', filename);
  return null;
}

export {
  getTmpPath,
  readTmpFile,
  writeTmpFile,
};
