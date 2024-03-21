#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const ora = require('ora');
const node_ssh = require('node-ssh');
const archiver = require('archiver');
const { successLog, errorLog, underlineLog } = require('../utils/index');

const projectDir = process.cwd();

let ssh = new node_ssh(); // 生成ssh实例

// 部署流程入口
async function deploy (config) {
  const { script, webDir, distPath, projectName, name } = config;
  try {
    await execBuild(script);
    await startZip(distPath);
    await connectSSH(config);
    await uploadFile(webDir);
    await deleteLocalZip();
    unzipFile(webDir).then(res => {
      successLog(`\n 部署成功了🌈🌈🌈\n`);
      process.exit(0);
    })
  } catch (err) {
    errorLog(`  部署失败 ${err}`);
    process.exit(1);
  }
}

// 第一步，执行打包脚本
async function execBuild (script) {
  try {
    console.log(`\n（1）${script}`);
    const spinner = ora('正在打包中');
    spinner.start();
    await childProcess.execSync(script, { cwd: projectDir });
    spinner.stop();
    successLog('  打包成功🎉🎉🎉');
  } catch (err) {
    errorLog(err);
    process.exit(1);
  }
}

// 第二部，打包zip
function startZip (distPath) {
  return new Promise((resolve, reject) => {
    distPath = path.resolve(projectDir, distPath);
    console.log('（2）打包成zip');
    const archive = archiver('zip', {
      zlib: { level: 9 },
    }).on('error', err => {
      throw err;
    });
    const output = fs.createWriteStream(`${projectDir}/dist.zip`);
    output.on('close', err => {
      if (err) {
        errorLog(`  关闭archiver异常 ${err}`);
        reject(err);
        process.exit(1);
      }
      successLog('  zip打包成功🎉🎉🎉');
      resolve();
    });
    archive.pipe(output);
    archive.directory(distPath, '/');
    archive.finalize();
  });
}

// 第三步，连接SSH
async function connectSSH (config) {
  const { host, port, username, password, privateKey, passphrase, distPath } = config;
  const sshConfig = {
    host,
    port,
    username,
    password,
    privateKey,
    passphrase
  };
  try {
    console.log(`（3）连接${underlineLog(host)}`);
    await ssh.connect(sshConfig);
    successLog('  SSH连接成功🎉🎉🎉');
  } catch (err) {
    errorLog(`  连接失败 ${err}`);
    process.exit(1);
  }
}

// 第四部，上传zip包
async function uploadFile (webDir) {
  try {
    console.log(`（4）上传zip至目录${underlineLog(webDir)}`);
    await ssh.putFile(`${projectDir}/dist.zip`, `${webDir}/dist.zip`);
    successLog('  zip包上传成功🎉🎉🎉');
  } catch (err) {
    errorLog(`  zip包上传失败 ${err}`);
    process.exit(1);
  }
}

// 第五步，删除本地dist.zip包
async function deleteLocalZip () {
  return new Promise((resolve, reject) => {
    console.log('（5）开始删除本地zip包');
    fs.unlink(`${projectDir}/dist.zip`, err => {
      if (err) {
        errorLog(`  本地zip包删除失败 ${err}`, err);
        reject(err);
        process.exit(1);
      }
      successLog('  本地zip包删除成功🎉🎉🎉\n');
      resolve();
    });
  });
}

// 第六步，解压并删除服务器zip包
function unzipFile (webDir) {
  return new Promise((resolve, reject) => {
    try {
      console.log('（6）开始解压zip包');
      ssh.execCommand(`cd ${webDir} && unzip -o dist.zip && rm -rf dist.zip`).then(res => {
        if (res.code === 0) {
          successLog('  zip包解压成功🎉🎉🎉');
          resolve()
        } else {
          errorLog(`  zip包解压失败：${res}`);
          process.exit(1);
        }
      })
    } catch (err) {
      reject()
      errorLog(`  zip包解压失败 ${err}`);
      process.exit(1);
    }
  })
}

module.exports = deploy;