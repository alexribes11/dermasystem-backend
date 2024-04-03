const { spawn } = require('child_process');

var options = {
    stdio: 'inherit' //feed all child process logging into parent process
};

const pythonOne = spawn('python3', ['./test_print.py'], options);

// The below gives a "error: spawn ./test_print.py EACCES"
/*
spawn('./test_print.py', (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});
*/

/*
pythonOne.stdout.setEncoding('utf8');
pythonOne.stdout.on('data', function(data) {
    console.log('stdout: ' + data);
});

pythonOne.stderr.setEncoding('utf8');
pythonOne.stderr.on('data', function(data) {
    console.log('stderr: ' + data);
});
*/

pythonOne.on('close', function(code) {
    process.stdout.write('"npm install" finished with code ' + code + '\n');
});