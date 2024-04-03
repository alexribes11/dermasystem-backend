//import {glob} from 'glob'
const glob = require('glob');

console.log("hi");
const myPathToProcessedFile = './outputImages/inpainted/artificial_hair/' + 'ip_Private_Individual_Garden_Plot'
glob.glob(myPathToProcessedFile + ".*", {cwd: '../../wherever/'}, function(err, paths) {
    console.log(err);
	const pathToFileWithExt = paths[0];
    console.log(pathToFileWithExt);
});
