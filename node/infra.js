
var fs = require('fs');
var yaml = require('js-yaml');


var outqueue,inqueue,done ;
init();
sendevent("/huangyg/itw/keys/","test");
readevent("/huangyg/itw/key/");


// cod

// jt

// dtt



// event
var evetnqueue;

function eventloop(){
	
}

// storage

// type:
// 	event: write\read
// 	status: current snapshot

// sendevent: 
//	write event into event.yaml	
//	public event to other nodes, and collect the eventqueue.
//	after call the listeners of the events in queue, delete it from event.yaml and write into done.yaml
//
//	maybe should generate a unique key here
function sendevent(k,v){
	if (outqueue[k] === undefined){
		outqueue[k] = v;
		outqueue.update = new Date().toLocaleString();
		fs.writeFileSync("outqueue.yaml",yaml.safeDump(outqueue));
		console.log("outqueue file wrote:\n",yaml.safeDump(outqueue));
	} else {
		console.log(k,"existed in outqueue file.\n");
	}
}

function readevent(k) {
	if (outqueue[k] != undefined){
		console.log("found in outqueue.");
		return outqueue[k];
	} else if (inqueue[k] != undefined){
		console.log("found in inqueue.");
		return inqueue[k];
	} else if (done[k] != undefined){
		console.log("found in done.");
		return done[k];
	}else {
		console.log("can not find this event.");
		return undefined;
	}
}

function init(){
	if (fs.existsSync("outqueue.yaml")) {
		outqueue = yaml.safeLoad(fs.readFileSync('outqueue.yaml', 'utf8'));
		// check the old version files, and transfer to new version
		for (var key in outqueue) {
			//console.log("key:\t"+key);
			if (key === "updateLocal") continue;
			if (key === "update") continue;
			
			}
	}else {
		outqueue = new Object();
		outqueue.update = new Date().toLocaleString();
		console.log("outqueue:\t"+outqueue);
		
		fs.writeFileSync("outqueue.yaml",yaml.safeDump(outqueue));
	};

	if (fs.existsSync("inqueue.yaml")) {
		inqueue = yaml.safeLoad(fs.readFileSync('inqueue.yaml', 'utf8'));
		// check the old version files, and transfer to new version
		for (var key in inqueue) {
			//console.log("key:\t"+key);
			if (key === "updateLocal") continue;
			if (key === "update") continue;
			
			}
	}else {
		inqueue = new Object();
		inqueue.update = new Date().toLocaleString();
		console.log("inqueue:\t"+inqueue);
		
		fs.writeFileSync("inqueue.yaml",yaml.safeDump(inqueue));
	};

	if (fs.existsSync("done.yaml")) {
		done = yaml.safeLoad(fs.readFileSync('done.yaml', 'utf8'));
		// check the old version files, and transfer to new version
		for (var key in done) {
			//console.log("key:\t"+key);
			if (key === "updateLocal") continue;
			if (key === "update") continue;
			
			}
	}else {
		done = new Object();
		done.update = new Date().toLocaleString();
		console.log("done:\t"+done);
		
		fs.writeFileSync("done.yaml",yaml.safeDump(done));
	};
}


// sync 
function sync(){
	
}
