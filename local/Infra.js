var fs = require('fs');
var events = require('events');
var http = require('http');
var https = require('https');
var path = require("path");

var yaml = require('js-yaml');
var async = require('async');
var openpgp = require('openpgp');
var Hashes = require('jshashes');


var emitter = new events.EventEmitter();
var config = yaml.safeLoad(fs.readFileSync('config.yaml', 'utf8'));
exports.emitter = emitter ;
exports.config = config ;

exports.getCODlist = getCODlist ;
exports.getCODObj = getCODObj ;
exports.createCOD = createCOD ;

exports.importNor = importNor ;
exports.createNor = createNor ;
exports.createAuto = createAuto ;
exports.updatebalance = updatebalance ;
exports.transfer = transfer ;
exports.CODtransfer = CODtransfer ;
exports.Issue = Issue ;

exports.postsync = postsync ;
exports.putsync = putsync ;
exports.sent = sent ;


exports.eventinit = eventinit ;
exports.getthisHash = getthisHash ;

var deploytime = Date.UTC(2015,1,1,0,0,0,0);

init();

// coop net
function getCODlist(){
	
}

function getCODObj(){
	
}

function createCOD(cod,passphrase,callback){
	var key = exports.key ;
	//console.log("createcod> key[cod.deployer]:",key[cod.deployer]);
	//console.log("createcod> key:\n",key);
	var deployersecfile = key[cod.deployer].keyprefix + ".sec";
	//console.log("createcod> deployersecfile:\n",fs.readFileSync(deployersecfile,'utf8'));
	var deployerseckey = openpgp.key.readArmored(fs.readFileSync(deployersecfile,'utf8')).keys[0];
	if(deployerseckey == undefined){
		console.log("createcod> deployer seckey fail.");
		callback(null);
		return;
	}

	var datastr = yaml.safeDump(cod);
	var item = new Object();

	item.cod = cod.name;
	item.id = GetHash(datastr,-1);
	item.tag = "deploy";
	item.author = cod.deployer;
	item.sigtype = 2;
	if(deployerseckey.decrypt(passphrase)){
		openpgp.signClearMessage(deployerseckey,datastr).then(function(pgpMessage){
			// success
			//console.log(pgpMessage);
			item.data = pgpMessage;
			
			sent(item,'POST',function (retstr){
				if (typeof(callback) != "undefined") {
					callback(retstr);
				}
			});
		}).catch(function(error) {
			// failure
			console.log("签名失败！"+error);
			callback(null);
		});
	}
}


// Joint Token
function readKey() {
	var key = new Object();
	
	var files = fs.readdirSync(".");
	files.forEach(function(item) {
		if (item.substr(item.length-4,4) === '.sec'){
			var seckey = openpgp.key.readArmored(fs.readFileSync(item,'utf8')).keys[0];
			existORcreateObj(key,seckey.primaryKey.fingerprint);
			key[seckey.primaryKey.fingerprint].owner = seckey.users[0].userId.userid;
			key[seckey.primaryKey.fingerprint].keyprefix = item.substr(0,item.length-4);
			existORcreate(key[seckey.primaryKey.fingerprint],"balance");
		}
	});

	files = fs.readdirSync("post/");

	files.forEach(function(item) {
		if(item.substr(0,4) == "nor."){
			var nor = yaml.safeLoad(fs.readFileSync("post/"+item,'utf8'));
			var pubkey = openpgp.key.readArmored(nor.data.pubkey).keys[0];
			existORcreateObj(key,pubkey.primaryKey.fingerprint);
			key[pubkey.primaryKey.fingerprint].owner = pubkey.users[0].userId.userid;
			key[pubkey.primaryKey.fingerprint].yamlfilename = "post/"+item;
			existORcreate(key[pubkey.primaryKey.fingerprint],"balance");
		}else if((item.substr(item.indexOf(".")+1,5) == "auto.") || (item.substr(0,5) == "auto.")){
			var auto = yaml.safeLoad(fs.readFileSync("post/"+item,'utf8'));
			existORcreateObj(key,auto.data.id);
			key[auto.data.id].owner = auto.cod;
			key[auto.data.id].yamlfilename = "post/"+item;
			existORcreate(key[auto.data.id],"balance");
		}
	});
	
	//console.log("readkey:\n",key);
	exports.key = key ;
	return key ;
}

function importNor(){
	var key = exports.key;
	
	for (var id in key) {
		if (!key[id].hasOwnProperty("yamlfilename")) {
			console.log("import key:\n",key[id]);
			var vid = id;
			//var seckeyArmored = fs.readFileSync(key[id].keyprefix+".sec",'utf8');
			var seckey = openpgp.key.readArmored(fs.readFileSync(key[id].keyprefix+".sec",'utf8')).keys[0];
			//var pubfilename = key[id].secfilename.substr(0,key[id].secfilename.length-4)+".pub" ;
			var pubkeyArmored = fs.readFileSync(key[id].keyprefix+".pub",'utf8');
			var owner = key[id].owner;
			var ownerid = owner.substr(owner.indexOf("(")+1,owner.indexOf(")")-owner.indexOf("(")-1) ;
			
			var data = new Object();
			data.id = seckey.primaryKey.fingerprint;
			data.keytype = 2;
			data.pubkey = pubkeyArmored;
			data.createtime =  new Date().getTime();//Date.parse(key.key.primaryKey.created);
			data.remark = "Import Normal Account";
			
			var item = new Object();
			item.tag = "nor";
			item.author = ownerid;
			item.data = data;
			item.sigtype = 0;
			
			sent(item,'POST',function (retstr){
				console.log("sent key callback:\n",key[id],key[vid]);
				fs.renameSync(key[vid].keyprefix+".pub",retstr+".pub");
				fs.renameSync(key[vid].keyprefix+".sec",retstr+".sec");
				key[vid].yamlfilename = "post/"+retstr+".yaml";
				key[vid].keyprefix = retstr;

				if (typeof(callback) != "undefined") {
					callback(balance);
				}
			});
		}
	}
	
	//console.log("importkey:\n",key);
	exports.key = key ;
	return key ;
}

function createNor(name,id,email,passphrase,callback){
	var UserId = name + " (" + id + ") <" + email + ">" ;
	
	var publicKey,privateKey;
	var opt = {numBits: 2048, userId: UserId, passphrase: passphrase};

	console.log("正在创建密钥对，需要几十秒时间，请稍候。。。");

	openpgp.generateKeyPair(opt).then(function(key) {
		
		var data = new Object();
		
		data.id = key.key.primaryKey.fingerprint;
		data.keytype = 2;
		data.pubkey = key.publicKeyArmored;
		data.createtime =  new Date().getTime();//Date.parse(key.key.primaryKey.created);
		data.remark = "Normal Account";
		
		//doc = yaml.safeDump(data);
		var authorseckey = openpgp.key.readArmored(key.privateKeyArmored).keys[0];
		
		var item = new Object();
		
		//item.cod = "";
		item.tag = "nor";
		item.author = id;
		item.data = data;
		item.sigtype = 0;
		
		sent(item,'POST',function (retstr){
			fs.writeFileSync(retstr+".pub",key.publicKeyArmored);
			fs.writeFileSync(retstr+".sec",key.privateKeyArmored);
			
			if (typeof(callback) != "undefined") {
				callback(retstr);
			}
		});
	});
}

function createAuto(url,author,name,callback){
	https.get(url,function (res){
		var js = ""; 
		res.setEncoding('utf8');

		res.on('data', function(data){
		  js += data ;
		});
		res.on('end', function(){
			console.log(js.toString());
			
			var data = new Object();
			data.id = GetHash(js.toString(),-1);
			data.codetype = 1;
			data.codeurl = url;
			data.createtime = new Date().getTime();
			data.remark = name+".auto";
			
			var item = new Object();
	
			item.cod = name;
			item.tag = "auto";
			item.author = author;
			item.data = data;
			item.sigtype = 0;

			if(exports.key.hasOwnProperty(data.id)){
				console.log("已经申请过了。");
			}else {
				sent(item,'POST',function (retstr){
					if (typeof(callback) != "undefined") {
						callback(retstr);
					}
				});	
			}
			
		});
		
	});
}

function updatebalance(callback) {
	var key = exports.key;
	
	var files = fs.readdirSync("post/");
	files.forEach(function(item) {
		if (item.substr(0,9) == "transfer."){
			var obj = yaml.safeLoad(fs.readFileSync("post/"+item, 'utf8'));

			var data ;
			if(obj.log != undefined){
				var log = yaml.safeLoad(obj.log);
				data = yaml.safeLoad(log.data);
			}else if (obj.sigtype == 0){
				data = obj.data;
			}else if (obj.sigtype == 2){
				data = obj.data;
				var msg = openpgp.cleartext.readArmored(data);
				var author = obj.author ;
				var nor = yaml.safeLoad(fs.readFileSync(key[author].yamlfilename,'utf8'));
				var pubkeys = openpgp.key.readArmored(nor.data.pubkey).keys;
				var pubkey = pubkeys[0];
				var result = msg.verify(pubkeys);
				data = yaml.safeLoad(msg.text);
			}
			if (data == undefined){
				console.log("invalid transfer:",item);
			}else {
				if(data.hasOwnProperty("input")) {
					var input = data.input;
					var id = input.id;
					var amount = input.amount;
					existORcreate(key[id],"balance");
					key[id].balance = key[id].balance - amount;
				}
				
				if(data.hasOwnProperty("output")) {
					var output = data.output;
					var id = output.id;
					var amount = output.amount;
					existORcreate(key[id],"balance");
					key[id].balance = key[id].balance + amount;
				}
			}
			
		}
	});
	
	files = fs.readdirSync("local/");
	files.forEach(function(item) {
		if (item.substr(0,9) == "transfer."){
			var obj = yaml.safeLoad(fs.readFileSync("local/"+item, 'utf8'));

			var data ;
			if(obj.log != undefined){
				var log = yaml.safeLoad(obj.log);
				data = yaml.safeLoad(log.data);
			}else if (obj.sigtype == 0){
				data = obj.data;
			}else if (obj.sigtype == 2){
				data = obj.data;
				var msg = openpgp.cleartext.readArmored(data);
				var author = obj.author ;
				var nor = yaml.safeLoad(fs.readFileSync(key[author].yamlfilename,'utf8'));
				var pubkeys = openpgp.key.readArmored(nor.data.pubkey).keys;
				var pubkey = pubkeys[0];
				var result = msg.verify(pubkeys);
				data = yaml.safeLoad(msg.text);
			}
			if(data.hasOwnProperty("input")) {
				var input = data.input;
				var id = input.id;
				var amount = input.amount;
				existORcreate(key[id],"balance");
				key[id].balance = key[id].balance - amount;
			}
			
			if(data.hasOwnProperty("output")) {
				var output = data.output;
				var id = output.id;
				var amount = output.amount;
				existORcreate(key[id],"balance");
				key[id].balance = key[id].balance + amount;
			}
		}
	});
	
	if (typeof(callback) != "undefined") {
		callback(key);
	}
	//console.log("updatebalance key:\n",key);
	exports.key = key ;

	return key ;
}

function Issue() {
	var data = new Object();
	var input = new Object();
	var output = new Object();
	data.jtid = '1c636fec7bdfdcd6bb0a3fe049e160d354fe9806';	// just for debug
	//input.id = payerid;
	//input.amount = amount;
	//data.input = input;
	output.id = "d4daa038556e2fc2b01f55036f4ff2d2e8c2fc78";
	output.amount = 8192;
	data.output = output;
	data.total = 8192;
	data.time =  new Date().getTime();//new Date().toLocaleString();
	data.remark = "issue sample";
	console.log(data);
	
	var datastr = yaml.safeDump(data);
	var item = new Object();
	item.type = 1;
	item.data = datastr;
	item.hashtype = -1;
	item.hash = GetHash(datastr,-1);
	item.sigtype = 0;

	doc = yaml.safeDump(item);
	
	//var authorseckey = payerseckey;
	var postbody = new Object();
	
	postbody.tag = "transfer";
	postbody.author = "JT";
	postbody.log = doc;
	postbody = yaml.safeDump(postbody);
	
	console.log(postbody);
	console.log(postbody.length);
	//fs.writeFileSync("postbody.yaml",postbody)
	
	var options = {
	  hostname: config.server.url,
	  port: config.server.port,
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/x-yaml'
	  }
	};
	
	console.log("sending transfer to server...")
	var req = http.request(options, function(res) {
	  console.log('STATUS: ' + res.statusCode);
	  console.log('HEADERS: ' + JSON.stringify(res.headers));
	  res.setEncoding('utf8');
	  res.on('data', function (chunk) {
		console.log('BODY: ' + chunk);
	  });
	});

	req.write(postbody);
	req.end();
}

function CODtransfer(payerid,payeeid,amount,callback){
	if(amount > exports.key[payerid].balance){
		console.log("overdraw");
		return;
	}
	
	var data = new Object();
	var input = new Object();
	var output = new Object();
	data.jtid = '1c636fec7bdfdcd6bb0a3fe049e160d354fe9806';	// just for debug
	input.id = payerid;
	input.amount = amount;
	data.input = input;
	output.id = payeeid;
	output.amount = amount;
	data.output = output;
	data.total = amount;
	data.time =  new Date().getTime();//new Date().toLocaleString();
	data.remark = "cod transfer sample";
	//console.log(data);
	
	var datastr = yaml.safeDump(data);
	var item = new Object();
	item.tag = "transfer";
	item.author = payerid;
	item.sigtype = 0;
	item.data = data;
	
	sentlocal(item,callback);
}

function transfer(payerid,payeeid,amount,passphrase,callback){
	var key = exports.key ;
	if(amount > exports.key[payerid].balance){
		console.log("overdraw");
		return;
	}
	
	//console.log("transfer key:",key);
	//console.log("transfer payerid:",payerid);
	//console.log("transfer key[payerid]:",key[payerid]);
	var payersecfile = key[payerid].keyprefix + ".sec";
	//var payerpubfile = payerid + ".pub";
	var payerseckey = openpgp.key.readArmored(fs.readFileSync(payersecfile,'utf8')).keys[0];
	//var payerpubkey = openpgp.key.readArmored(fs.readFileSync(payerpubfile,'utf8')).keys[0];
	
	var payeepubfile = key[payeeid].yamlfilename;
	//console.log("transfer payeeid:",payeeid)
	//console.log("transfer pubfile:",pubfile)
	//console.log("transfer payeepubfile:",payeepubfile)
	var nor = yaml.safeLoad(fs.readFileSync(payeepubfile,'utf8'));
	//var payeepubkey = openpgp.key.readArmored(nor.data.pubkey).keys[0];
	
	var data = new Object();
	var input = new Object();
	var output = new Object();
	data.jtid = '1c636fec7bdfdcd6bb0a3fe049e160d354fe9806';	// just for debug
	data.type = 3;
	input.id = payerseckey.primaryKey.fingerprint;
	input.amount = amount;
	data.input = input;
	output.id = payeeid.toString();
	output.amount = amount;
	data.output = output;
	data.total = amount;
	data.time =  new Date().getTime();//new Date().toLocaleString();
	data.remark = "transfer sample";
	//console.log(data);
	
	var datastr = yaml.safeDump(data);
	var item = new Object();
	item.tag = "transfer";
	item.author = payerid;
	item.sigtype = 2;
	//item.hash = new Hashes.SHA512().b64(datastr);
	
	if(payerseckey.decrypt(passphrase)){
		//var sig = openpgp.sign(payerseckey,data);
		//console.log("infra.transfer:",sig);
		//console.log("infra.transfer:",data);
		openpgp.signClearMessage(payerseckey,datastr).then(function(pgpMessage){
			// success
			//console.log(pgpMessage);
			item.data = pgpMessage;
			
			sent(item,'POST',callback);
		}).catch(function(error) {
			// failure
			console.log("签名失败！"+error);
		});
	}
}

// distribute storage
var localPostIdx,localPutIdx,localIdx;
var globalPostIdx ,globalPutIdx;
var postfileArray = new Array() ;
var putfileArray = new Array() ;

function sent(item,method,callback){
	var itemyaml = yaml.safeDump(item);
	var options = {
	  hostname: config.server.url,
	  port: config.server.port,
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/x-yaml'
	  }
	};
	
	console.log("sending account to server...\n");

	var req = http.request(options, function(res) {
	  //console.log('STATUS: ' + res.statusCode);
	  //console.log('HEADERS: ' + JSON.stringify(res.headers));
	  res.setEncoding('utf8');

	  res.on('data', function (chunk) {
		console.log('response BODY: ' + chunk);
		if (typeof(callback) != "undefined") {
			callback(chunk);
		}
		emitter.emit("postsync");
	  });
	});
	
	req.write(itemyaml);
	req.end();
}

function sentlocal(item,callback){
	var key;
	if (item.hasOwnProperty("cod")) {
		key = item.cod + "." + item.tag + "." + item.author;
	} else {
		key = item.tag + "." + item.author;
	}
	if (!localIdx.hasOwnProperty(key)) {
		localIdx[key] = 0;
		localIdx.update = new Date().toLocaleString();
		fs.writeFile("local/index.yaml",yaml.safeDump(localIdx),function(err){
			console.log("local notify: create a new key ["+key+"].\n");
		});
	}
	
	var filename;
	localIdx[key] = localIdx[key] + 1;
	if (item.hasOwnProperty("cod")) {
		filename = "local/" + item.cod + "." + item.tag + "." + item.author + "." + (localIdx[key]) + ".yaml";
	} else {
		filename = "local/" + item.tag + "." + item.author + "." + (localIdx[key]) + ".yaml";
	}
	fs.exists(filename, function (exists) {
		if (exists) {
			console.log("local fail: file "+filename+" exist.");
		} else {
			item.createat = new Date().getTime();
			fs.writeFile(filename,yaml.safeDump(item),function(err){
				if(err) throw err;
				console.log("local:",filename);
				
				//localIdx[key] = localIdx[key] + 1;
				localIdx.update = new Date().getTime();
				localIdx.updateLocal = new Date().toLocaleString();
				
				fs.writeFileSync("local/index.yaml",yaml.safeDump(localIdx));
				
				localsync(item);
			});
		}
	})
}

function putsync(finish) {
	if (typeof(finish) != "undefined") {
		finish();
	}
}

function postsync(finish) {
	postfileArray = new Array() ;
	var addr = "http://"+config.server.url+":"+config.server.port+'/post/index.yaml';
	var req = http.get(addr, function(res) {
		var postindex = ""; 
		res.setEncoding('utf8');
		
		res.on('data', function(data){
		  postindex += data ;
		});
		res.on('end', function(){
			globalPostIdx = yaml.safeLoad(postindex);
			for (var key in globalPostIdx) {
				//console.log("key:\t"+key);
				if (key === "updateLocal") continue;
				if (key === "update") {
					var globaltime = globalPostIdx[key];
					//console.log("globaltime",globaltime);
					var localtime = localPostIdx[key];
					//console.log("localtime",localtime);
					var nextdate = new Date(localtime+86400000);
					//console.log("nextdate",nextdate);
					var nextday = nextdate.getTime()-(nextdate.getUTCHours()*60*60+nextdate.getUTCMinutes()*60+nextdate.getUTCSeconds())*1000-nextdate.getUTCMilliseconds();
					//console.log("nextday",nextday);
					for(var t=nextday;t<=globaltime;t= t+86400000) {
						//console.log("t=",t,new Date(t).toUTCString());
						eventqueue[t]="newday";
					}
					continue;
				}
				
				
				if (!localPostIdx.hasOwnProperty(key)) {
					localPostIdx[key] = 0;
				}
				//console.log(localPostIdx[key]);
				//console.log(globalPostIdx[key]);
				if (localPostIdx[key] < globalPostIdx[key]){
					for (var id = localPostIdx[key]+1;id <= globalPostIdx[key];id++) {
						//console.log("\npostsync file:\t",key+"."+id.toString()+".yaml");
						postfileArray.push(key+"."+id.toString()+".yaml") ;
					}
					localPostIdx[key] = globalPostIdx[key];
				}
			}
			//var createtime = new Object();
			var updatefile = new Object();
			
			async.each(postfileArray, function (item, callback) {
				var fileaddr = "http://"+config.server.url+":"+config.server.port+'/post/'+item;
				var req = http.get(fileaddr, function(res) {
					var chunk = ""; 
					res.setEncoding('utf8');
					
					res.on('data', function(data){
					  chunk += data ;
					});
					res.on('end', function(){
						//console.log("post: "+item+" downloaded.\n",chunk);

						var itemdata = yaml.safeLoad(chunk);
						var obj = new Object();
						obj.path = "post/";
						obj.filename = item;
						obj.content = chunk;

						existORcreateObj(eventqueue,itemdata.createat);
						existORcreateArray(eventqueue[itemdata.createat],itemdata.tag);
						eventqueue[itemdata.createat][itemdata.tag].push(obj);

						callback();
					});
				}).on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
			}, function (err) {
				if( err ) {
					console.log('post:A file failed to save');
				} else {
					localPostIdx.update = new Date().getTime();
					localPostIdx.updateLocal = new Date().toLocaleString();
					fs.writeFileSync("post/index.yaml",yaml.safeDump(localPostIdx));
					
					console.log("postsync> eventqueue:\n",eventqueue)
					emitter.emit("eventloop");
				}
			});
		});
	}).on('error', function(e) {
	  console.log('problem with request: ' + e.message);
	});
}

function localsync(item) {
	var key = exports.key;

	if (item.tag == "transfer"){
		var data ;
		if(item.log != undefined){
			var log = yaml.safeLoad(item.log);
			data = yaml.safeLoad(log.data);
		}else if (item.sigtype == 0){
			data = item.data;
		}else if (item.sigtype == 2){
			data = item.data;
			var msg = openpgp.cleartext.readArmored(data);
			var author = item.author ;
			var nor = yaml.safeLoad(fs.readFileSync(key[author].yamlfilename,'utf8'));
			var pubkeys = openpgp.key.readArmored(nor.data.pubkey).keys;
			var pubkey = pubkeys[0];
			var result = msg.verify(pubkeys);
			data = yaml.safeLoad(msg.text);
		}
		if(data.hasOwnProperty("input")) {
			var input = data.input;
			var id = input.id;
			var amount = input.amount;
			//console.log("input:\t",key,"[",id,"]",key[id])
			existORcreateObj(key,id);
			existORcreate(key[id],"balance");
			key[id].balance = key[id].balance - amount;
		}
		
		if(data.hasOwnProperty("output")) {
			var output = data.output;
			var id = output.id;
			var amount = output.amount;
			//console.log("output:\t",key,"[",id,"]",key[id])
			existORcreateObj(key,id);
			existORcreate(key[id],"balance");
			key[id].balance = key[id].balance + amount;
		}
	}
	//console.log("postfile finish, key:",key);
	exports.key = key;
}

emitter.on("postsync",postsync);

// distribute event driver
var eventqueue = new Object(); // or save in exports?
var eventcallbackcnt = 0;

emitter.on("eventloop",eventloop);
function eventloop(){
	var min = new Date().getTime();
	var getmin = false;
	//console.log("eventqueue> min init:",min);
	
	for(key in eventqueue){
		if (min > key) {
			min = key;
			getmin = true;
		}
	}
	if (getmin == false){
		return;
	}
	
	console.log("eventqueue> event.time:",min,new Date(parseInt(min)).toUTCString());
	//console.log("eventqueue> eventqueue[min]:",eventqueue[min]);
	
	var key = exports.key;
	if (eventqueue[min].hasOwnProperty("nor")) {
		var item = eventqueue[min].nor.pop();
		fs.writeFileSync(item.path+item.filename,item.content);
		if (eventqueue[min].nor.length == 0) {
			delete eventqueue[min].nor;
			console.log("eventqueue> delete eventqueue[min].nor");
		}
		var nor = yaml.safeLoad(item.content);
		var pubkey = openpgp.key.readArmored(nor.data.pubkey).keys[0];
		existORcreateObj(key,pubkey.primaryKey.fingerprint);
		key[pubkey.primaryKey.fingerprint].owner = pubkey.users[0].userId.userid;
		key[pubkey.primaryKey.fingerprint].yamlfilename = "post/"+item.filename;
		existORcreate(key[pubkey.primaryKey.fingerprint],"balance");
		
		eventcallbackcnt = events.EventEmitter.listenerCount(emitter, "nor");
		if(eventcallbackcnt > 0){
			emitter.emit("nor",item,eventcallback);
		}else{
			emitter.emit("eventloop");
		}
		exports.key = key;
	}else if (eventqueue[min].hasOwnProperty("deploy")) {
		var item = eventqueue[min].deploy.pop();
		//console.log("eventloop> deploy.item:\n",item);
		fs.writeFileSync(item.path+item.filename,item.content);
		if (eventqueue[min].deploy.length == 0) {
			delete eventqueue[min].deploy;
			console.log("eventqueue> delete eventqueue[min].deploy");
		}
		
		var data ;
		var cod = yaml.safeLoad(item.content);
		console.log("eventloop> deploy.cod:\n",cod);
		if (cod.sigtype == 2){
			data = cod.data;
			var msg = openpgp.cleartext.readArmored(data);
			var author = cod.author ;
			var nor = yaml.safeLoad(fs.readFileSync(key[author].yamlfilename,'utf8'));
			var pubkeys = openpgp.key.readArmored(nor.data.pubkey).keys;
			var pubkey = pubkeys[0];
			var result = msg.verify(pubkeys);
			data = yaml.safeLoad(msg.text);
		}

		var codfilename = item.filename.substr(0,item.filename.lastIndexOf(".")) + ".js" ;
		fs.writeFileSync(codfilename,data.listener);
		
		var a = require("./"+codfilename);
		for (var event in a){
			console.log("eventloop> deploy add event:",event);
			emitter.on(event,a[event]);
		}
		
		eventcallbackcnt = events.EventEmitter.listenerCount(emitter, "deploy");

		if(eventcallbackcnt > 0){
			emitter.emit("deploy",item,eventcallback);
		}else{
			emitter.emit("eventloop");
		}
	}else if (eventqueue[min].hasOwnProperty("auto")) {
		var item = eventqueue[min].auto.pop();
		//console.log("eventqueue> auto.item:\n",item);
		fs.writeFileSync(item.path+item.filename,item.content);
		if (eventqueue[min].auto.length == 0) {
			delete eventqueue[min].auto;
			console.log("eventqueue> delete eventqueue[min].auto");
		}
		
		var auto = yaml.safeLoad(item.content);
		var autofilename = item.filename.substr(0,item.filename.lastIndexOf(".")) + ".js" ;
		
		console.log("new auto account: download "+auto.data.codeurl+" and saved as "+autofilename);
		var autoget = https.get(auto.data.codeurl,function(res) {
			var chunk = ""; 
			res.setEncoding('utf8');

			res.on('data', function(data){
			  chunk += data ;
			});
			res.on('end', function(){
				fs.writeFileSync(autofilename,chunk);

				existORcreateObj(key,auto.data.id);
				//console.log("auto account downloaded:",key[auto.data.id]);
				key[auto.data.id].owner = auto.cod;
				key[auto.data.id].yamlfilename = item.filename;
				existORcreate(key[auto.data.id],"balance");
				//console.log("auto account update:",key[auto.data.id]);
				
				var a = require("./"+autofilename);
				//console.log("eventloop> auto.a:",a);
				for (var event in a){
					console.log("eventloop> auto add event:",event);
					//console.log("eventloop> auto.a.event:",a[event]);
					emitter.on(event,a[event]);
				}
				
				eventcallbackcnt = events.EventEmitter.listenerCount(emitter, "auto");

				if(eventcallbackcnt > 0){
					emitter.emit("auto",item,eventcallback);
				}else{
					emitter.emit("eventloop");
				}
				exports.key = key;
			});
		});
	}else if (eventqueue[min].hasOwnProperty("transfer")) {
		var item = eventqueue[min].transfer.pop();
		fs.writeFileSync(item.path+item.filename,item.content);
		if (eventqueue[min].transfer.length == 0) {
			delete eventqueue[min].transfer;
			console.log("eventqueue> delete eventqueue[min].transfer");
		}
		
		var obj = yaml.safeLoad(item.content);

		var data ;
		if(obj.log != undefined){
			var log = yaml.safeLoad(obj.log);
			data = yaml.safeLoad(log.data);
		}else if (obj.sigtype == 0){
			data = obj.data;
		}else if (obj.sigtype == 2){
			data = obj.data;
			var msg = openpgp.cleartext.readArmored(data);
			var author = obj.author ;
			//console("\n\ndebug:",key,author,"\n\n");
			//console.log("\n\ndebug:",key[author],"\n\n");
			//console.log("\n\ndebug:",key[author].yamlfilename,"\n\n");
			var nor = yaml.safeLoad(fs.readFileSync(key[author].yamlfilename,'utf8'));
			var pubkeys = openpgp.key.readArmored(nor.data.pubkey).keys;
			var pubkey = pubkeys[0];
			var result = msg.verify(pubkeys);
			data = yaml.safeLoad(msg.text);
		}
		if(data.hasOwnProperty("input")) {
			var input = data.input;
			var id = input.id;
			var amount = input.amount;
			//console.log("input:\t",key,"[",id,"]",key[id])
			existORcreateObj(key,id);
			existORcreate(key[id],"balance");
			key[id].balance = key[id].balance - amount;
		}
		
		if(data.hasOwnProperty("output")) {
			var output = data.output;
			var id = output.id;
			var amount = output.amount;
			//console.log("output:\t",key,"[",id,"]",key[id])
			existORcreateObj(key,id);
			existORcreate(key[id],"balance");
			key[id].balance = key[id].balance + amount;
		}
		
		eventcallbackcnt = events.EventEmitter.listenerCount(emitter, "transfer");
		
		if(eventcallbackcnt > 0){
			emitter.emit("transfer",item,eventcallback);
		}else{
			emitter.emit("eventloop");
		}
		exports.key = key;
	}else if(eventqueue[min] === "newday"){
		//console.log("eventqueue> newday:",min);
		eventcallbackcnt = events.EventEmitter.listenerCount(emitter, "newday");
		//console.log("eventqueue> newday.eventcallbackcnt:",eventcallbackcnt);
		if(eventcallbackcnt > 0){
			emitter.emit("newday",min,eventcallback);
			console.log("eventqueue> delete eventqueue[min].newday");
		}else{
			delete eventqueue[min];
			emitter.emit("eventloop");
		}
	}else {
		console.log("eventqueue> delete eventqueue[min]");
		delete eventqueue[min];
		emitter.emit("eventloop");
	}
	
}

function eventcallback(){
	console.log("eventcallback> eventcallbackcnt:",eventcallbackcnt);
	eventcallbackcnt--;
	if(eventcallbackcnt === 0){
		emitter.emit("eventloop");
	}
}

// data management
function deploy() {
	localindexinit();
	readKey();
	importNor();
	postsync();
}

function init() {
	localindexinit();
	readKey();
	updatebalance();
	eventinit();

	postsync();
}

//utility

function sortObject(o) {
    var sorted = {},
    key, a = [];

    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }

    a.sort();

    for (key = 0; key < a.length; key++) {
        sorted[a[key]] = o[a[key]];
    }
    return sorted;
}

function sortObject2Array(o) {
    var sorted = [],
    key, a = [];

    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }

    a.sort();

    for (key = 0; key < a.length; key++) {
        sorted.push(o[a[key]]);
    }
    return sorted;
}

function sortObject2ArrayReverse(o) {
    var sorted = [],
    key, a = [];

    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }

    a.sort();

    for (key = a.length-1 ; key >=0 ; key--) {
        sorted.push(o[a[key]]);
    }
    return sorted;
}


function existORcreate(obj,id) {
	//console.log(id);
	if (!obj.hasOwnProperty(id)) {
		obj[id] = 0;
	}
}

function existORcreateObj(obj,id) {
	//console.log(id);
	if (!obj.hasOwnProperty(id)) {
		obj[id] = new Object();
	}
}

function existORcreateArray(obj,id) {
	//console.log(id);
	if (!obj.hasOwnProperty(id)) {
		obj[id] = new Array();
	}
}

function getthisHash(filename){
	if (filename == undefined){
		filename = process.argv[1];
	}
	//console.log("getthisHash filename:\t",filename)
	var data = fs.readFileSync(filename);
	var datahash = GetHash(data.toString(),-1)
	
	return datahash;
}

function GetHash(str,type){
	var MD5 = new Hashes.MD5;
	var SHA1 = new Hashes.SHA1;
	var SHA256 =  new Hashes.SHA256;
	var SHA512 = new Hashes.SHA512;
	var RMD160 = new Hashes.RMD160;
/*
* hashtype： 哈希算法类型
	* -1: default, SHA1 hex for now.
	* 1:MD5 hex
	* 2:MD5 b64
	* 3:SHA1 hex
	* 4:SHA1 b64
	* 5:SHA256 hex
	* 6:SHA256 b64
	* 7:SHA512 hex
	* 8:SHA512 b64
	* 9:RIPEMD-160 hex
	* 10:RIPEMD-160 b64
*/
	switch (type) {
		case 1:
		return MD5.hex(str);
		break;
		case 2:
		return MD5.b64(str);
		break;
		case 3:
		return SHA1.hex(str);
		break;
		case 4:
		return SHA1.b64(str);
		break;
		case 5:
		return SHA256.hex(str);
		break;
		case 6:
		return SHA256.b64(str);
		break;
		case 7:
		return SHA512.hex(str);
		break;
		case 8:
		return SHA512.b64(str);
		break;
		case 9:
		return RMD160.hex(str);
		break;
		case 10:
		return RMD160.b64(str);
		break;
		default:
		return SHA1.hex(str);
		break;
	}
}

function eventinit() {
	var files = fs.readdirSync("post/");
	files.forEach(function(item) {
		if((item.substr(item.indexOf(".")+1,5) == "auto.") || (item.substr(0,5) == "auto.")){
			var auto = yaml.safeLoad(fs.readFileSync("post/"+item, 'utf8'));
			var autofilename = item.substr(0,item.lastIndexOf(".")) + ".js" ;
			var a = require("./"+autofilename);
			
			for (var event in a){
					emitter.on(event,a[event]);
			}
		}
	});
}

function localindexinit(){
	mkdirsSync("post",0777);
	fs.exists("post/index.yaml", function (exists) {
		if (exists) {
			localPostIdx = yaml.safeLoad(fs.readFileSync('post/index.yaml', 'utf8'));
		}else {
			localPostIdx = new Object();
			localPostIdx.update = deploytime;
			localPostIdx.updateLocal = new Date(deploytime).toLocaleString();
			fs.writeFileSync("post/index.yaml",yaml.safeDump(localPostIdx));
		}
	});
	
	mkdirsSync("put",0777);
	fs.exists("put/index.yaml", function (exists) {
		if (exists) {
			localPutIdx = yaml.safeLoad(fs.readFileSync('put/index.yaml', 'utf8'));
		}else {
			localPutIdx = new Object();
			localPutIdx.update = deploytime;
			localPutIdx.updateLocal = new Date(deploytime).toLocaleString();
			fs.writeFileSync("put/index.yaml",yaml.safeDump(localPutIdx));
		}
	});
	
	mkdirsSync("local",0777);
	fs.exists("local/index.yaml", function (exists) {
		if (exists) {
			localIdx = yaml.safeLoad(fs.readFileSync('local/index.yaml', 'utf8'));
		}else {
			localIdx = new Object();
			localIdx.update = deploytime;
			localIdx.updateLocal = new Date(deploytime).toLocaleString();
			fs.writeFileSync("local/index.yaml",yaml.safeDump(localIdx));
		}
	});	
}

//创建多层文件夹 同步
function mkdirsSync(dirpath, mode) { 
    if (!fs.existsSync(dirpath)) {
        var pathtmp;
        dirpath.split(path.sep).forEach(function(dirname) {
            if (pathtmp) {
                pathtmp = path.join(pathtmp, dirname);
            }
            else {
                pathtmp = dirname;
            }
            if (!fs.existsSync(pathtmp)) {
				console.log("create dir:\t",pathtmp)
                if (!fs.mkdirSync(pathtmp, mode)) {
                    return false;
                }
            }
        });
    }
    return true; 
}