var util			= require('util');
var EventEmitter	= require('events').EventEmitter;

util.inherits(Device, EventEmitter);
/*************************************************************

                    THE DEVICE CLASS
**************************************************************/

function Device(adapter, connection, gps_server){
	/* Inherits EventEmitter class */
	EventEmitter.call(this);

	var this_device 	= this;

	this.connection 	= connection;
	this.server 		= gps_server;
	this.adapter		= adapter.adapter(this);

	this.uid = false;
	this.ip = connection.ip;
	this.port = connection.port;
	this.name = false;
	this.loged = false;

    this.lastUpdateTime = 0;
    this.lastIsEmpty = false;


    var that = this;

	init();
	/* init */
	function init(){ 

        var timeInterval = 1000 * 60 * 10;
        // set up timer for recording to .json file
        setInterval(function(){
            var now = new Date();
            if(now.getTime() - that.lastUpdateTime > timeInterval && !that.lastIsEmpty){
                var fs = require('fs');
                fs.appendFile(
                    that.server.opts.gpx_log_location + that.server.opts.port + "_" + now.getFullYear() + "-"+ (now.getMonth()+1) + "-" + (now.getDate()) + ".json",
                    "[],", 
                    function(err) {
                        if(err) {
                            return console.log(err);
                        }
                    }
                ); 
                that.lastIsEmpty = true;
                that.lastUpdateTime  = now.getTime();
            }
        }, timeInterval);
    }

	/****************************************
	RECEIVING DATA FROM THE DEVICE
	****************************************/
	this.on("data",function(data) {
		msg_parts = this_device.adapter.parse_data(data);

		if(this.getUID() === false && typeof(msg_parts.device_id) == "undefined"){
			throw "The adapter doesn't return the device_id and is not defined";
		}

		if(msg_parts === false) { //something bad happened
			this_device.do_log("The message (" + data + ") can't be parsed. Discarding...");
			return;
		}

		if(typeof(msg_parts.cmd) == "undefined"){
            throw "The adapter doesn't return the command (cmd) parameter";
        }

		//If the UID of the devices it hasn't been setted, do it now.
		if(this.getUID() === false)
			this.setUID(msg_parts.device_id);

		/************************************
		EXECUTE ACTION
		************************************/
        this._storeDataLog(data, msg_parts.action);
		this_device.make_action(msg_parts.action,msg_parts);
	});

	this.make_action = function(action, msg_parts) {
		//If we're not loged
        /*
		if(action != "login_request" && !this_device.loged){
			this_device.adapter.request_login_to_device();
			console.log(this_device.getUID()+" is trying to '" + action + "' but it isn't loged. Action wasn't executed");
			return false;
		}
        */
		switch(action){
			case "login_request":
				this_device.login_request(msg_parts);
				break;
			case "ping":
				this_device.ping(msg_parts);
				break;
			case "clock":
				this_device.synchronous_clock(msg_parts);
				break;
			case "alarm":
				this_device.receive_alarm(msg_parts);
				break;
			case "heartbeat":
				this_device.receive_heartbeat(msg_parts);
				break;
			case "other":
				this_device.adapter.run_other(msg_parts.cmd,msg_parts);
				break;
		}
	};



	/****************************************
	LOGIN & LOGOUT
	****************************************/
	this.login_request = function(msg_parts) {
		//this_device.do_log("I'm requesting to be loged.");
		this_device.emit("login_request",this.getUID(),msg_parts);
	};
	this.login_authorized = function(val, msg_parts) {
		if(val){
			//this.do_log("Device " + this_device.getUID() + " has been authorized. Welcome!");
			this.loged = true;
			this.adapter.authorize(msg_parts);
		}else{
			this.do_log("Device " + this_device.getUID() + " not authorized. Login request rejected");
		}
	};
	this.logout = function(){
		this.loged = false;
		this.adapter.logout();
	};


	/****************************************
	RECEIVING GPS POSITION FROM THE DEVICE
	****************************************/
	this.ping = function(msg_parts){
		var gps_data = this.adapter.get_ping_data(msg_parts);
		if(gps_data === false){
			//Something bad happened
			this_device.do_log("GPS Data can't be parsed. Discarding packet...");
			return false;
		}

		/* Needs:
		latitude, longitude, time
		Optionals:
		orientation, speed, mileage, etc */

		this_device.do_log("Position received ( " + gps_data.latitude + "," + gps_data.longitude + " )");

		gps_data.inserted = new Date();
		gps_data.from_cmd = msg_parts.cmd;
        this._logGPXData(gps_data);
        

		this_device.emit("ping", gps_data);
	};

    // change point to bdmap format then append to .json file
    // .json file for map
    // .gpx file for archive
    this._logGPXData = function(data){
        var request = require('request');
        var now = new Date();
        var timeString =  ",\""  + now.getHours() + ":" + now.getMinutes() + "\"";
        var that = this;
        request({
            uri: 'http://api.map.baidu.com/geoconv/v1/?coords=' + data.longitude +  ',' + data.latitude +  '&from=1&to=5&ak=n5KBr6oygvDsnVSlre6R9BYGlpXP8la2',
            method: 'GET',
        },  function (err, res, body) {
            var json = JSON.parse(body);
            var fs = require('fs');
            fs.appendFile(
                this_device.server.opts.gpx_log_location + this_device.server.opts.port + "_" + now.getFullYear() + "-"+ (now.getMonth()+1) + "-" + (now.getDate()) + ".json",
                "[" + json['result'][0]['x'] + ","+json['result'][0]['y'] + timeString +  "],", 
                function(err) {
                    if(err) {
                        return console.log(err);
                    }
                }
            ); 
        });
    
    };

    this._storeDataLog = function(data, action){
        var fs = require('fs');
        var f = require("./functions");
        var now = new Date();
        fs.appendFile(
            this_device.server.opts.gpx_log_location + this_device.server.opts.port + ".log",
            now + ": " + action + ": "  + f.bufferToHexString(data) + "\n",
            function(err) {
                if(err) {
                    return console.log(err);
                }
            }
        ); 
    };

	/****************************************
	RECEIVING ALARM
	****************************************/
	this.receive_alarm = function(msg_parts) {
		var alarm_data = this_device.adapter.receive_alarm(msg_parts);
		this_device.emit("alarm", alarm_data.code, alarm_data, msg_parts);
	};

	this.receive_heartbeat = function(msg_parts) {
        this.adapter.receive_heartbeat(msg_parts);
	};

	this.synchronous_clock = function(msg_parts) {
        this.adapter.synchronous_clock(msg_parts);
	};

	this.synchronous_clock_06 = function(msg_parts) {
        this.adapter.synchronous_clock_06(msg_parts);
	};

	/****************************************
	SET REFRESH TIME
	****************************************/
	this.set_refresh_time = function(interval, duration) {
		this_device.adapter.set_refresh_time(interval, duration);
	};

	/* adding methods to the adapter */
	this.adapter.get_device = function(){
		return device;
	};
	this.send = function(msg){
		this.emit("send_data",msg);
		this.connection.write(msg);
        this._storeDataLog(msg, "send");
	};

	this.do_log = function (msg){
		this_device.server.do_log(msg,this_device.getUID());
	};

	this.send_byte_array = function(array){
		this.emit("send_byte_data",array);
		var buff = new Buffer(array);
        this._storeDataLog(array, "send");
	};

	/****************************************
	SOME SETTERS & GETTERS
	****************************************/
	this.getName = function(){
		return this.name;
	};
	this.setName = function(name) {
		this.name = name;
	};

	this.getUID = function() {
		return this.uid;
	};
	this.setUID = function(uid) {
		this.uid = uid;
	};

}

exports.Device = Device;
